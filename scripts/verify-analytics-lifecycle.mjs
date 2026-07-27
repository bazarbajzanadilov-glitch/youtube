import assert from 'node:assert/strict'

import {
  aggregateSubscriberSeries,
  build,
  buildSubscriberSeries,
  getAnalyticsEndDate,
  resolveRange,
} from '../src/lib/analyticsAggregator.js'
import {
  generateLifecycleShape,
  hashSeed,
  normalizeToTotal,
} from '../src/lib/analyticsEngine.js'
import { getAlmatyDateISO } from '../src/lib/almatyDate.js'
import {
  generateVideoStats,
  makeId,
  normalizeVideo,
} from '../src/storage/videoStore.js'
import {
  avgWatchPercent,
  avgWatchPretty,
  buildPublishedVideoMarkers,
  daysSinceLong,
} from '../src/screens/analytics/studioAnalyticsHelpers.js'

const DAY_MS = 86_400_000
const SUBSCRIBER_WEIGHT_EPOCH_MS = Date.parse('2020-01-01T00:00:00Z')

function subscriberHistoryWeight(date, manualMultiplier = 1) {
  const ordinal = Math.floor(
    (Date.parse(`${date}T00:00:00Z`) - SUBSCRIBER_WEIGHT_EPOCH_MS) / DAY_MS,
  )
  const tau = 2 * Math.PI
  const automaticWeight = Math.max(0.8, Math.min(
    1.2,
    1
      + 0.10 * Math.sin((tau * ordinal) / 11 + 0.7)
      + 0.06 * Math.sin((tau * ordinal) / 29 + 1.9)
      + 0.035 * Math.sin((tau * ordinal) / 5 + 2.6),
  ))
  const boundedManualMultiplier = Math.max(0.9, Math.min(1.1, manualMultiplier))
  return Math.max(0.8, Math.min(1.2, automaticWeight * boundedManualMultiplier))
}

function allocateSubscriberHistory(total, dates, manualMultiplierForDate = () => 1) {
  const target = Math.max(0, Math.trunc(Number(total) || 0))
  if (dates.length === 0 || target === 0) return []
  const activeDates = dates.slice(-Math.min(dates.length, target))

  const rows = activeDates.map((date) => ({
    date,
    gained: 1,
    lost: 0,
    weight: subscriberHistoryWeight(date, manualMultiplierForDate(date)),
  }))
  const extraTarget = target - rows.length
  const weightTotal = rows.reduce((sum, row) => sum + row.weight, 0)
  rows.forEach((row) => {
    const exactExtra = (extraTarget * row.weight) / weightTotal
    row.gained += Math.floor(exactExtra)
    row.fraction = exactExtra - Math.floor(exactExtra)
  })
  const remainder = target - rows.reduce((sum, row) => sum + row.gained, 0)
  ;[...rows]
    .sort((a, b) => b.fraction - a.fraction || a.date.localeCompare(b.date))
    .slice(0, remainder)
    .forEach((row) => { row.gained += 1 })
  return rows.map(({ date, gained, lost }) => ({ date, gained, lost }))
}

function isoDatesEndingAt(endDate, days) {
  const end = Date.parse(`${endDate}T00:00:00Z`)
  return Array.from({ length: days }, (_, index) => (
    new Date(end - (days - index - 1) * DAY_MS).toISOString().slice(0, 10)
  ))
}

const today = new Date('2026-05-12T12:00:00')
const channel = {
  channelName: 'inside-trading',
  country: 'RU',
  subscriberCount: 12000,
  monetizationEnabled: true,
}

const generatedIds = new Set(
  Array.from({ length: 500 }, () => makeId('Repeated video title')),
)
assert.equal(generatedIds.size, 500, 'bulk-generated video IDs must be unique')

const todayStats = generateVideoStats({
  id: 'today-video',
  title: 'Today video',
  date: '2026-05-12',
  duration: '8:12',
  today,
})
const oldStats = generateVideoStats({
  id: 'old-video',
  title: 'Old evergreen video',
  date: '2025-11-12',
  duration: '8:12',
  today,
})

assert.ok(todayStats.views < oldStats.views, 'today video should have lower accumulated views than an old video')
assert.ok(todayStats.revenue < oldStats.revenue, 'today video should have lower accumulated revenue than an old video')

const lifecycle = generateLifecycleShape({
  seed: hashSeed('old-video', 'shape'),
  days: 181,
  profile: 'decayAfterPeak',
  startWeekday: 3,
})
assert.equal(lifecycle.length, 181)
assert.ok(lifecycle[0] < Math.max(...lifecycle) * 0.12, 'video should start near zero')
assert.ok(lifecycle[lifecycle.length - 1] > 0, 'long-tail should stay above zero')

const oldVideo = {
  id: 'old-video',
  title: 'Old evergreen video',
  date: '2025-11-12',
  duration: '8:12',
  views: oldStats.views,
  revenue: oldStats.revenue,
  likes: oldStats.likes,
  dislikes: oldStats.dislikes,
  likePct: oldStats.likePct,
  averageViewPercentage: 52.5,
  profile: 'decayAfterPeak',
}
const analytics = build([oldVideo], channel, { kind: '28d' }, { today })
const analytics7Days = build([oldVideo], channel, { kind: '7d' }, { today })
const analytics365Days = build([oldVideo], channel, { kind: '365d' }, { today })
const analyticsLifetime = build([oldVideo], channel, { kind: 'lifetime' }, { today })
const contentMetricImpressions = analytics.content.metricSeries.reduce(
  (sum, row) => sum + row.impressions,
  0,
)
assert.equal(
  Math.round(contentMetricImpressions),
  analytics.content.kpis.impressions.value,
  'content impression chart must reconcile to its KPI',
)
assert.ok(
  analytics.content.metricSeries.every((row) => (
    Number.isFinite(row.ctr)
    && row.ctr >= 0
    && Number.isFinite(row.averageViewDuration)
    && row.averageViewDuration >= 0
  )),
  'content CTR and average-duration series must contain valid chart values',
)
assert.ok(
  analytics365Days.content.metricSeries.every((row) => (
    Number.isFinite(row.impressions)
    && Number.isFinite(row.ctr)
    && Number.isFinite(row.averageViewDuration)
  )),
  'monthly content metric buckets must preserve all switchable chart fields',
)
assert.deepEqual(
  analytics7Days.realtime.last48,
  analytics.realtime.last48,
  '48-hour realtime views must not change with the selected analytics range',
)
assert.deepEqual(
  analytics365Days.realtime.last48,
  analytics.realtime.last48,
  '365-day selection must not rescale the current 48-hour window',
)
assert.deepEqual(
  analyticsLifetime.realtime.last48,
  analytics.realtime.last48,
  'lifetime selection must not rescale the current 48-hour window',
)
assert.deepEqual(
  analytics7Days.monetization.sixMonthSeries,
  analytics365Days.monetization.sixMonthSeries,
  'the fixed six-month revenue panel must not depend on the selected range',
)
assert.equal(
  analytics7Days.audience.monthlyViewers,
  analytics365Days.audience.monthlyViewers,
  'current rolling monthly viewers must not depend on the selected range',
)
assert.equal(
  analyticsLifetime.overview.kpis.views.delta,
  null,
  'lifetime KPIs must not show a fabricated previous-period comparison',
)
assert.equal(
  analyticsLifetime.overview.series.reduce((sum, row) => sum + row.views, 0),
  analyticsLifetime.overview.kpis.views.value,
  'lifetime chart views must exactly reconcile to the lifetime KPI',
)
assert.equal(
  +analyticsLifetime.overview.series
    .reduce((sum, row) => sum + row.revenue, 0)
    .toFixed(2),
  analyticsLifetime.monetization.kpis.revenue.value,
  'lifetime chart revenue must exactly reconcile to the lifetime KPI',
)
const realtimeAllocated = analytics.realtime.topVideos.reduce(
  (sum, video) => sum + video.realtimeViews,
  0,
)
assert.equal(
  realtimeAllocated,
  analytics.realtime.last48.reduce((sum, value) => sum + value, 0),
  'per-video realtime views must reconcile to the 48-hour channel total',
)
assert.equal(
  analytics.overview.topVideos.reduce((sum, video) => sum + video.periodViews, 0),
  analytics.overview.kpis.views.value,
  'period video metrics must reconcile to the period views KPI',
)
const equivalentCustomAnalytics = build(
  [oldVideo],
  channel,
  {
    kind: 'custom',
    from: analytics.range.from,
    to: analytics.range.to,
  },
  { today },
)
assert.deepEqual(
  equivalentCustomAnalytics.overview.series,
  analytics.overview.series,
  'identical calendar dates must produce identical points regardless of range label',
)
assert.deepEqual(
  equivalentCustomAnalytics.content.traffic,
  analytics.content.traffic,
  'period share cards must use the same dated inputs for equivalent calendar ranges',
)
assert.deepEqual(
  analytics7Days.audience.newReturning,
  analytics.audience.newReturning.slice(-analytics7Days.audience.newReturning.length),
  'new and returning audience values must stay stable on overlapping calendar dates',
)
assert.equal(
  analytics365Days.audience.newReturning.reduce(
    (sum, row) => sum + row.new + row.returning,
    0,
  ),
  analytics365Days.overview.kpis.views.value,
  'weekly/monthly new and returning viewers must reconcile to period views',
)
const emptyRealtime = build([], channel, { kind: '28d' }, { today }).realtime
assert.deepEqual(
  emptyRealtime.last48,
  new Array(48).fill(0),
  'channels without recent views must not receive fabricated realtime activity',
)
const lowVolumeAnalytics = build(
  [{
    ...oldVideo,
    id: 'low-volume-video',
    date: '2026-05-01',
    views: 100,
    revenue: 0,
    likes: 2,
  }],
  channel,
  { kind: '28d' },
  { today },
)
assert.ok(
  lowVolumeAnalytics.realtime.last48.reduce((sum, value) => sum + value, 0) > 0,
  'small channels must retain low but non-zero realtime activity',
)
const revenueSeries = analytics.overview.series.map((d) => d.revenue)
const totalRevenue = revenueSeries.reduce((sum, value) => sum + value, 0)
const nonZeroRevenueDays = revenueSeries.filter((value) => value > 0).length
const maxRevenueDay = Math.max(...revenueSeries)

assert.ok(nonZeroRevenueDays > 10, 'revenue should be distributed across many days')
assert.ok(maxRevenueDay / totalRevenue < 0.35, 'revenue should not be concentrated in one day')
assert.equal(avgWatchPercent(oldVideo), '52,5%')
assert.equal(avgWatchPretty(oldVideo), '4:18')

const normalizedVideo = normalizeVideo({
  ...oldVideo,
  averageViewPercentage: 64.8,
})
assert.equal(normalizedVideo.averageViewPercentage, 64.8)
assert.equal(
  normalizeVideo({ title: 'Updated title' }, { base: normalizedVideo }).averageViewPercentage,
  64.8,
  'patches without the field must preserve the stored percentage',
)
assert.equal(normalizeVideo({ ...oldVideo, averageViewPercentage: -1 }).averageViewPercentage, 0)
assert.equal(normalizeVideo({ ...oldVideo, averageViewPercentage: 101 }).averageViewPercentage, 100)
assert.equal(normalizeVideo({ ...oldVideo, averageViewPercentage: '' }).averageViewPercentage, null)
assert.equal(avgWatchPercent({ ...oldVideo, averageViewPercentage: null }), '—')
assert.equal(avgWatchPretty({ ...oldVideo, averageViewPercentage: null }), '—')

const noPercentageAnalytics = build(
  [{ ...oldVideo, averageViewPercentage: null }],
  channel,
  { kind: '28d' },
  { today },
)
assert.equal(
  noPercentageAnalytics.overview.kpis.watchTime.value,
  0,
  'missing percentage must not fall back to a fabricated watch-time ratio',
)
const mixedRetentionAnalytics = build(
  [
    oldVideo,
    {
      ...oldVideo,
      id: 'unknown-retention-video',
      views: oldVideo.views * 10,
      averageViewPercentage: null,
    },
  ],
  channel,
  { kind: '28d' },
  { today },
)
assert.equal(
  Math.round(mixedRetentionAnalytics.content.kpis.avgDuration.value),
  258,
  'videos with unknown retention must not dilute the known average duration',
)

const futureVideo = {
  ...oldVideo,
  id: 'future-video',
  date: '2026-05-20',
}
const futureAnalytics = build([futureVideo], channel, { kind: '7d' }, { today })
assert.equal(futureAnalytics.overview.kpis.views.value, 0, 'future videos should not contribute views')
assert.equal(futureAnalytics.monetization.kpis.revenue.value, 0, 'future videos should not contribute revenue')
const futureLifetimeAnalytics = build([futureVideo], channel, { kind: 'lifetime' }, { today })
assert.equal(
  futureLifetimeAnalytics.overview.kpis.views.value,
  0,
  'future videos must not leak into lifetime KPIs',
)
assert.deepEqual(
  futureLifetimeAnalytics.realtime.topVideos,
  [],
  'future videos must not appear in realtime top content',
)
assert.deepEqual(
  futureLifetimeAnalytics.overview.topVideos,
  [],
  'future videos must not appear in period rankings',
)

const boundedMarkers = buildPublishedVideoMarkers(
  [{ date: '2025-12-29' }, { date: '2026-01-05' }],
  [
    { id: 'before', date: '2026-01-02', title: 'Before' },
    { id: 'inside-first-bucket', date: '2026-01-04', title: 'Inside first bucket' },
    { id: 'inside-last-bucket', date: '2026-01-10', title: 'Inside last bucket' },
    { id: 'after', date: '2026-01-11', title: 'After' },
  ],
  'date',
  { from: new Date('2026-01-03'), to: new Date('2026-01-10') },
)
assert.deepEqual(
  boundedMarkers.flatMap((marker) => marker.videos.map((video) => video.id)).sort(),
  ['inside-first-bucket', 'inside-last-bucket'],
  'weekly publication markers must respect the exact selected range boundaries',
)

function localIso(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

const beforeAlmatyMidnight = new Date('2026-07-23T18:59:59.000Z')
const afterAlmatyMidnight = new Date('2026-07-23T19:00:00.000Z')
assert.equal(getAlmatyDateISO(beforeAlmatyMidnight), '2026-07-23')
assert.equal(getAlmatyDateISO(afterAlmatyMidnight), '2026-07-24')
assert.equal(
  daysSinceLong('2026-07-23', beforeAlmatyMidnight),
  'Опубликовано сегодня',
)
assert.equal(
  daysSinceLong('2026-07-23', afterAlmatyMidnight),
  '1 день после публикации',
)
assert.equal(
  localIso(getAnalyticsEndDate(beforeAlmatyMidnight)),
  '2026-07-22',
  'before midnight in Almaty the completed reporting day should be July 22',
)
assert.equal(
  localIso(getAnalyticsEndDate(afterAlmatyMidnight)),
  '2026-07-23',
  'after midnight in Almaty the completed reporting day should be July 23',
)

const almatyRange = resolveRange({ kind: '7d' }, [], afterAlmatyMidnight)
assert.equal(localIso(almatyRange.from), '2026-07-17')
assert.equal(localIso(almatyRange.to), '2026-07-23')

const clampedCustomRange = resolveRange({
  kind: 'custom',
  from: '2026-07-20',
  to: '2026-07-24',
}, [], afterAlmatyMidnight)
assert.equal(
  localIso(clampedCustomRange.to),
  '2026-07-23',
  'custom analytics ranges must exclude the current Almaty day',
)

const normalized = normalizeToTotal(lifecycle, oldStats.views)
assert.equal(Math.round(normalized.reduce((sum, value) => sum + value, 0)), oldStats.views)

const subscriberChannel = {
  ...channel,
  subscriberDailyStats: [
    { date: '2026-05-08', gained: 5, lost: 2 },
    { date: '2026-05-09', gained: 1, lost: 4 },
    { date: '2026-05-10', gained: 2, lost: 0 },
  ],
}
const subscriberAnalytics = build([], subscriberChannel, { kind: '7d' }, { today })
const positiveSubscriberDay = subscriberAnalytics.audience.subscribers.find((row) => row.date === '2026-05-08')
const negativeSubscriberDay = subscriberAnalytics.audience.subscribers.find((row) => row.date === '2026-05-09')

assert.equal(positiveSubscriberDay.subscribers, 5, 'subscriber charts should show the positive gained count')
assert.equal(negativeSubscriberDay.subscribers, 1, 'lost subscribers should not create negative chart values')
assert.equal(subscriberAnalytics.overview.kpis.subscribers.value, 8, 'period KPI should sum positive gained counts')
assert.equal(subscriberAnalytics.overview.kpis.subscribers.gained, 8)
assert.equal(subscriberAnalytics.overview.kpis.subscribers.lost, 6)
assert.equal(
  subscriberAnalytics.overview.kpis.subscribers.value,
  subscriberAnalytics.audience.kpis.subscribers.value,
  'overview and audience should use the same subscriber KPI',
)

const subscriberLifetime = build([], subscriberChannel, { kind: 'lifetime' }, { today })
assert.equal(
  subscriberLifetime.overview.kpis.subscribers.value,
  8,
  'lifetime subscriber KPI should include the complete stored subscriber history',
)
assert.ok(
  subscriberLifetime.range.from <= new Date('2026-05-08'),
  'lifetime range should start from subscriber history even when the channel has no videos',
)

const changedAbsoluteSubscriberCount = build(
  [],
  { ...subscriberChannel, subscriberCount: 999999 },
  { kind: '7d' },
  { today },
)
assert.deepEqual(
  changedAbsoluteSubscriberCount.audience.subscribers,
  subscriberAnalytics.audience.subscribers,
  'the current total subscriber count must not generate or change subscriber history',
)

const rawSubscriberSeries = buildSubscriberSeries(subscriberChannel, [
  { date: '2026-05-08' },
  { date: '2026-05-09' },
  { date: '2026-05-11' },
])
assert.deepEqual(rawSubscriberSeries, [
  { date: '2026-05-08', gained: 5, lost: 2, subscribers: 5 },
  { date: '2026-05-09', gained: 1, lost: 4, subscribers: 1 },
])

const subscriberBucketsSource = [
  { date: '2026-01-31', gained: 5, lost: 2, subscribers: 3 },
  { date: '2026-02-01', gained: 1, lost: 4, subscribers: -3 },
  { date: '2026-02-02', gained: 2, lost: 0, subscribers: 2 },
]
assert.deepEqual(aggregateSubscriberSeries(subscriberBucketsSource, 'week'), [
  { date: '2026-01-26', gained: 6, lost: 6, subscribers: 6 },
  { date: '2026-02-02', gained: 2, lost: 0, subscribers: 2 },
])
assert.deepEqual(aggregateSubscriberSeries(subscriberBucketsSource, 'month'), [
  { date: '2026-01-01', gained: 5, lost: 2, subscribers: 5 },
  { date: '2026-02-01', gained: 3, lost: 4, subscribers: 3 },
])

const smoothSubscriberDates = isoDatesEndingAt('2026-07-27', 365)
const smoothSubscriberHistory = allocateSubscriberHistory(1_446_000, smoothSubscriberDates)
const smoothSubscriberValues = smoothSubscriberHistory.map((row) => row.gained)
const smoothSubscriberAverage = 1_446_000 / smoothSubscriberHistory.length

assert.equal(smoothSubscriberHistory.length, 365)
assert.equal(smoothSubscriberHistory.at(-1).date, '2026-07-27')
assert.equal(
  smoothSubscriberValues.reduce((sum, value) => sum + value, 0),
  1_446_000,
  'smooth subscriber allocation must reconcile exactly to the channel total',
)
assert.ok(
  smoothSubscriberValues.every((value) => Number.isInteger(value) && value > 0),
  'every completed day for an active channel must have a positive integer gain',
)
assert.ok(
  Math.min(...smoothSubscriberValues) >= smoothSubscriberAverage * 0.75,
  'the bounded formula must not create artificial low outliers',
)
assert.ok(
  Math.max(...smoothSubscriberValues) <= smoothSubscriberAverage * 1.25,
  'the bounded formula must not create artificial high outliers',
)
assert.ok(
  smoothSubscriberValues.every((value, index) => (
    index === 0
    || Math.abs(value - smoothSubscriberValues[index - 1]) <= smoothSubscriberAverage * 0.18
  )),
  'adjacent completed days must change gradually',
)
assert.ok(
  Math.abs(subscriberHistoryWeight('2026-07-27') - 1.1396004062571419) < 1e-12,
  'the JS reference must use the same 2020-01-01 epoch as the SQL function',
)

for (const total of [0, 1, 10, 364, 365, 1_000, 1_446_000]) {
  const rows = allocateSubscriberHistory(total, smoothSubscriberDates)
  assert.equal(rows.length, Math.min(365, total), `history length for total ${total}`)
  assert.equal(
    rows.reduce((sum, row) => sum + row.gained, 0),
    total,
    `exact subscriber reconciliation for total ${total}`,
  )
  assert.ok(
    rows.every((row) => Number.isInteger(row.gained) && row.gained > 0),
    `no zero or fractional completed days for total ${total}`,
  )
}

const boundedManualHistory = allocateSubscriberHistory(
  1_446_000,
  smoothSubscriberDates,
  (date) => (Number(date.slice(-2)) % 2 === 0 ? 0.9 : 1.1),
)
const boundedManualValues = boundedManualHistory.map((row) => row.gained)
assert.ok(
  Math.min(...boundedManualValues) >= smoothSubscriberAverage * 0.75
    && Math.max(...boundedManualValues) <= smoothSubscriberAverage * 1.25,
  'admin adjustments must remain inside the same safe daily envelope',
)

const nextDaySubscriberHistory = allocateSubscriberHistory(
  1_446_000,
  isoDatesEndingAt('2026-07-28', 365),
)
assert.equal(nextDaySubscriberHistory.at(-1).date, '2026-07-28')
assert.ok(
  nextDaySubscriberHistory.at(-1).gained > 0,
  'the daily refresh must add a positive newest completed day',
)

console.log('analytics lifecycle verification passed')
