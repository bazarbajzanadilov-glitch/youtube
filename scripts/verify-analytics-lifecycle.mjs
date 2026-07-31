import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

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
import { reconcileSubscriberHistoryToTotal } from '../src/lib/subscriberHistory.js'
import {
  formatHours,
  formatSignedCompactNumber,
} from '../src/lib/analyticsFormat.js'
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
  metricPerformanceComparison,
  previousPeriodComparison,
  usualComparison,
} from '../src/screens/analytics/studioAnalyticsHelpers.js'

const DAY_MS = 86_400_000
const SUBSCRIBER_WEIGHT_EPOCH_MS = Date.parse('2020-01-01T00:00:00Z')
const STUDIO_CHANNEL_ID = '00000000-0000-0000-0000-000000000001'

function subscriberHistoryWeight(
  date,
  manualMultiplier = 1,
  channelId = STUDIO_CHANNEL_ID,
) {
  const ordinal = Math.floor(
    (Date.parse(`${date}T00:00:00Z`) - SUBSCRIBER_WEIGHT_EPOCH_MS) / DAY_MS,
  )
  const tau = 2 * Math.PI
  const channelSeed = (
    createHash('md5').update(channelId).digest().readUInt32BE(0)
    / 4_294_967_295
  )
  const automaticWeight = Math.max(0.4, Math.min(
    1.8,
    Math.exp(
      0.48 * Math.sin((tau * ordinal) / 112 + tau * channelSeed - 0.5)
      + 0.07 * Math.sin((tau * ordinal) / 11 + 0.7)
      + 0.03 * Math.sin((tau * ordinal) / 5 + 2.6),
    ),
  ))
  const boundedManualMultiplier = Math.max(0.9, Math.min(1.1, manualMultiplier))
  return Math.max(0.4, Math.min(1.8, automaticWeight * boundedManualMultiplier))
}

function allocateSubscriberHistory(
  total,
  dates,
  manualMultiplierForDate = () => 1,
  channelId = STUDIO_CHANNEL_ID,
) {
  const target = Math.max(0, Math.trunc(Number(total) || 0))
  if (dates.length === 0 || target === 0) return []
  const activeDates = dates.slice(-Math.min(dates.length, target))

  const rows = activeDates.map((date) => ({
    date,
    gained: 1,
    lost: 0,
    weight: subscriberHistoryWeight(date, manualMultiplierForDate(date), channelId),
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
const analytics90Days = build([oldVideo], channel, { kind: '90d' }, { today })
const analytics365Days = build([oldVideo], channel, { kind: '365d' }, { today })
const analyticsYear = build([oldVideo], channel, { kind: 'year-2026' }, { today })
const analyticsLifetime = build([oldVideo], channel, { kind: 'lifetime' }, { today })

assert.notEqual(
  Math.round(analytics.overview.kpis.views.delta),
  Math.round(analytics.overview.kpis.watchTime.delta),
  'views and watch-time comparisons must use independent daily shapes',
)
assert.ok(
  Math.abs(
    analyticsLifetime.overview.kpis.watchTime.value
    - (oldVideo.views * 492 * 0.525) / 3600,
  ) < 1 / 3600,
  'independent watch-time history must still reconcile to the lifetime total',
)

const persistedDates = isoDatesEndingAt('2026-05-11', 56)
const persistedRows = persistedDates.map((date, index) => {
  const views = index < 28 ? 100 : 120
  return {
    videoId: 'persisted-video',
    date,
    views,
    watchSeconds: views * (index < 28 ? 170 : 190),
    engagedViews: Math.round(views * 0.6),
    impressions: views * 10,
    likes: Math.round(views * 0.1),
    comments: Math.round(views * 0.02),
    revenue: +(views * 0.005).toFixed(2),
  }
})
const persistedTotals = persistedRows.reduce((totals, row) => ({
  views: totals.views + row.views,
  likes: totals.likes + row.likes,
  revenue: totals.revenue + row.revenue,
}), { views: 0, likes: 0, revenue: 0 })
const persistedVideo = {
  ...oldVideo,
  id: 'persisted-video',
  date: '2026-03-01',
  views: persistedTotals.views,
  likes: persistedTotals.likes,
  revenue: persistedTotals.revenue,
}
const persistedChannel = {
  ...channel,
  videoDailyStats: persistedRows,
}
const persistedAnalytics = build(
  [persistedVideo],
  persistedChannel,
  { kind: '28d' },
  { today },
)

assert.equal(
  persistedAnalytics.overview.kpis.views.value,
  28 * 120,
  'current KPI must sum persisted daily views',
)
assert.equal(
  persistedAnalytics.overview.kpis.views.previousValue,
  28 * 100,
  'previous KPI must sum the immediately preceding stored dates',
)
assert.equal(
  persistedAnalytics.content.kpis.impressions.previousValue,
  28 * 1_000,
  'previous impressions must sum persisted daily impressions',
)
assert.equal(
  Math.round(persistedAnalytics.overview.kpis.views.delta),
  20,
  'comparison percentage must be calculated from persisted period sums',
)
assert.notEqual(
  Math.round(persistedAnalytics.overview.kpis.views.delta),
  Math.round(persistedAnalytics.overview.kpis.watchTime.delta),
  'persisted views and watch time must retain distinct period comparisons',
)
assert.notEqual(
  metricPerformanceComparison(
    persistedAnalytics.overview.kpis.views,
    { kind: '28d', days: 28 },
  ),
  metricPerformanceComparison(
    persistedAnalytics.overview.kpis.watchTime,
    { kind: '28d', days: 28 },
  ),
  'the rendered views and watch-time comparison labels must differ',
)
assert.equal(
  persistedAnalytics.overview.kpis.views.value,
  persistedAnalytics.content.kpis.views.value,
  'overview and content must expose the same persisted views KPI',
)
assert.equal(
  persistedAnalytics.overview.kpis.likes.value,
  persistedAnalytics.content.kpis.likes.value,
  'overview and content must expose the same persisted likes KPI',
)
assert.deepEqual(
  persistedAnalytics.overview.series,
  persistedAnalytics.content.series,
  'overview and content charts must share the same persisted series',
)

const viewsOnlyRows = persistedRows.map((row) => (
  row.date === '2026-05-11'
    ? { ...row, views: row.views + 600 }
    : row
))
const viewsOnlyAnalytics = build(
  [{ ...persistedVideo, views: persistedVideo.views + 600 }],
  { ...persistedChannel, videoDailyStats: viewsOnlyRows },
  { kind: '28d' },
  { today },
)
assert.equal(
  viewsOnlyAnalytics.overview.kpis.views.value,
  persistedAnalytics.overview.kpis.views.value + 600,
  'a views-only mutation must update the views KPI',
)
assert.equal(
  viewsOnlyAnalytics.overview.kpis.views.previousValue,
  persistedAnalytics.overview.kpis.views.previousValue,
  'a views-only mutation must preserve previous views',
)
assert.equal(
  viewsOnlyAnalytics.overview.kpis.watchTime.value,
  persistedAnalytics.overview.kpis.watchTime.value,
  'a views-only mutation must not change stored watch time',
)
assert.equal(
  viewsOnlyAnalytics.overview.kpis.watchTime.delta,
  persistedAnalytics.overview.kpis.watchTime.delta,
  'a views-only mutation must not change the watch-time comparison',
)

const watchOnlyRows = persistedRows.map((row) => (
  row.date === '2026-05-11'
    ? { ...row, watchSeconds: row.watchSeconds + 108_000 }
    : row
))
const watchOnlyAnalytics = build(
  [persistedVideo],
  { ...persistedChannel, videoDailyStats: watchOnlyRows },
  { kind: '28d' },
  { today },
)
assert.equal(
  watchOnlyAnalytics.overview.kpis.watchTime.value,
  persistedAnalytics.overview.kpis.watchTime.value + 30,
  'a watch-only mutation must update the watch-time KPI',
)
assert.equal(
  watchOnlyAnalytics.overview.kpis.watchTime.previousValue,
  persistedAnalytics.overview.kpis.watchTime.previousValue,
  'a watch-only mutation must preserve previous watch time',
)
assert.equal(
  watchOnlyAnalytics.overview.kpis.views.value,
  persistedAnalytics.overview.kpis.views.value,
  'a watch-only mutation must not change stored views',
)
assert.equal(
  watchOnlyAnalytics.overview.kpis.views.delta,
  persistedAnalytics.overview.kpis.views.delta,
  'a watch-only mutation must not change the views comparison',
)

const mutatedPersistedRows = persistedRows.map((row) => (
  row.date === '2026-05-11'
    ? {
      ...row,
      views: row.views + 600,
      watchSeconds: row.watchSeconds + 108_000,
      engagedViews: row.engagedViews + 360,
      impressions: row.impressions + 6_000,
      likes: row.likes + 60,
      comments: row.comments + 12,
      revenue: row.revenue + 3,
    }
    : row
))
const mutatedPersistedAnalytics = build(
  [{ ...persistedVideo, views: persistedVideo.views + 600 }],
  { ...persistedChannel, videoDailyStats: mutatedPersistedRows },
  { kind: '28d' },
  { today },
)
assert.equal(
  mutatedPersistedAnalytics.overview.kpis.views.value,
  persistedAnalytics.overview.kpis.views.value + 600,
  'a stored current-period mutation must immediately change the current KPI',
)
assert.equal(
  mutatedPersistedAnalytics.overview.kpis.views.previousValue,
  persistedAnalytics.overview.kpis.views.previousValue,
  'a stored current-period mutation must leave the previous period unchanged',
)
assert.notEqual(
  mutatedPersistedAnalytics.overview.kpis.views.delta,
  persistedAnalytics.overview.kpis.views.delta,
  'a stored current-period mutation must recalculate the comparison percentage',
)
assert.equal(
  mutatedPersistedAnalytics.content.kpis.impressions.previousValue,
  persistedAnalytics.content.kpis.impressions.previousValue,
  'current impression edits must not rewrite the previous period',
)
assert.notEqual(
  mutatedPersistedAnalytics.content.kpis.impressions.delta,
  persistedAnalytics.content.kpis.impressions.delta,
  'stored impression edits must recalculate their comparison percentage',
)
assert.notEqual(
  mutatedPersistedAnalytics.content.kpis.likes.delta,
  persistedAnalytics.content.kpis.likes.delta,
  'stored like edits must recalculate their comparison percentage',
)
assert.equal(
  mutatedPersistedAnalytics.overview.kpis.watchTime.value,
  persistedAnalytics.overview.kpis.watchTime.value + 30,
  'stored watch seconds must drive the watch-time KPI',
)

const lifetimeOnlyMutation = build(
  [{ ...persistedVideo, views: persistedVideo.views + 999_999 }],
  persistedChannel,
  { kind: '28d' },
  { today },
)
assert.equal(
  lifetimeOnlyMutation.overview.kpis.views.value,
  persistedAnalytics.overview.kpis.views.value,
  'persisted projects must never regenerate history from a lifetime total',
)

const persistedWeekly = build(
  [persistedVideo],
  persistedChannel,
  { kind: '90d' },
  { today },
)
const persistedMonthly = build(
  [persistedVideo],
  persistedChannel,
  { kind: '365d' },
  { today },
)
for (const result of [persistedWeekly, persistedMonthly]) {
  assert.equal(
    result.overview.series.reduce((sum, row) => sum + row.views, 0),
    persistedTotals.views,
    'weekly and monthly buckets must preserve the persisted daily total',
  )
  assert.equal(
    result.content.metricSeries.reduce((sum, row) => sum + row.impressions, 0),
    persistedRows.reduce((sum, row) => sum + row.impressions, 0),
    'weekly and monthly buckets must sum stored impressions',
  )
}
assert.equal(persistedWeekly.range.days, 90)
assert.equal(persistedMonthly.range.days, 365)

assert.equal(
  usualComparison({ value: 100, delta: -50 }, (value) => String(Math.round(value))),
  'Значение ниже обычного (на 100)',
)
assert.equal(
  usualComparison({ value: 100, delta: 5 }, (value) => String(Math.round(value))),
  'Обычное значение',
)
assert.equal(
  previousPeriodComparison({ value: 76, delta: -24.4 }, { kind: '28d', days: 28 }),
  'На 24 % меньше, чем за предыдущие 28 дней',
)
assert.equal(
  previousPeriodComparison({ value: 126, delta: 25.6 }, { kind: '28d', days: 28 }),
  'На 26 % больше, чем за предыдущие 28 дней',
)
assert.equal(
  previousPeriodComparison({ value: 126, delta: 25.6 }, { kind: 'lifetime', days: 365 }),
  'На 26 % больше, чем за предыдущие 365 дней',
)
assert.equal(
  previousPeriodComparison({ value: 1_099, delta: 999 }, { kind: '90d', days: 90 }),
  'На 999 % больше, чем за предыдущие 90 дней',
)
assert.equal(
  previousPeriodComparison({ value: 1_099, delta: 999.4 }, { kind: '90d', days: 90 }),
  'На 999 % больше, чем за предыдущие 90 дней',
)
assert.equal(
  previousPeriodComparison({ value: 1_100, delta: 999.5 }, { kind: '90d', days: 90 }),
  'На >999 % больше, чем за предыдущие 90 дней',
)
assert.equal(
  previousPeriodComparison({ value: 1_100, delta: 1_000 }, { kind: '90d', days: 90 }),
  'На >999 % больше, чем за предыдущие 90 дней',
)
assert.equal(
  metricPerformanceComparison(
    { value: 3_100, previousValue: 100, delta: 3_000 },
    { kind: '90d', days: 90 },
  ),
  'На >999 % больше, чем за предыдущие 90 дней',
)
assert.equal(
  previousPeriodComparison({ value: 1_100, delta: Number.POSITIVE_INFINITY }, { kind: '90d', days: 90 }),
  'На >999 % больше, чем за предыдущие 90 дней',
)
assert.equal(formatSignedCompactNumber(0), '0')
assert.equal(formatSignedCompactNumber(0.3), '+0,3')
assert.equal(formatSignedCompactNumber(28.7), '+28,7')
assert.equal(formatSignedCompactNumber(999), '+999')
assert.equal(formatSignedCompactNumber(1_000), '+1\u00a0тыс.')
assert.equal(formatSignedCompactNumber(6_188), '+6,1\u00a0тыс.')
assert.equal(formatSignedCompactNumber(9_700), '+9,7\u00a0тыс.')
assert.equal(formatSignedCompactNumber(1_100_000), '+1,1\u00a0млн')
assert.equal(formatSignedCompactNumber(-6_188), '-6,1\u00a0тыс.')
assert.equal(
  metricPerformanceComparison(
    { value: 431, previousValue: 41, delta: 951 },
    { kind: '7d', days: 7 },
  ),
  'На 951 % больше, чем за предыдущие 7 дней',
)
assert.equal(
  metricPerformanceComparison(
    { value: 13_100, previousValue: 21_600, delta: -39.35 },
    { kind: '28d', days: 28 },
  ),
  'Значение ниже обычного (на 8,5\u00a0тыс.)',
)
assert.equal(
  metricPerformanceComparison(
    { value: 5_000, previousValue: 6_200, delta: -19.35 },
    { kind: '28d', days: 28 },
  ),
  'Значение ниже обычного (на 1,2\u00a0тыс.)',
)
assert.equal(
  metricPerformanceComparison(
    { value: 28.7, previousValue: 130, delta: -77.92 },
    { kind: '28d', days: 28 },
    formatHours,
  ),
  'Значение ниже обычного (на 101,3)',
)
assert.equal(
  metricPerformanceComparison(
    { value: 100, previousValue: 100, delta: 0 },
    { kind: '28d', days: 28 },
  ),
  'Обычное значение',
)
assert.equal(
  metricPerformanceComparison(
    { value: 100, previousValue: 90, delta: 11.1 },
    { kind: 'lifetime', days: 365 },
  ),
  'На 11 % больше, чем за предыдущие 365 дней',
)

const comparisonResults = [
  analytics7Days,
  analytics,
  analytics90Days,
  analytics365Days,
  analyticsYear,
  analyticsLifetime,
]
for (const result of comparisonResults) {
  const { range } = result
  const notes = [
    metricPerformanceComparison(result.overview.kpis.views, range),
    metricPerformanceComparison(result.overview.kpis.watchTime, range, formatHours),
    previousPeriodComparison(result.overview.kpis.subscribers, range),
    metricPerformanceComparison(result.content.kpis.views, range),
    previousPeriodComparison(result.content.kpis.engagedViews, range),
    previousPeriodComparison(result.content.kpis.likes, range),
    previousPeriodComparison(result.content.kpis.subscribers, range),
    previousPeriodComparison(result.audience.kpis.subscribers, range),
  ]
  assert.ok(
    notes.every((note) => typeof note === 'string' && note.length > 0),
    `${range.kind} must retain all analytics KPI comparison descriptions`,
  )

  for (const typeKpis of Object.values(result.content.kpisByType)) {
    const typeNotes = [
      metricPerformanceComparison(typeKpis.views, range),
      previousPeriodComparison(typeKpis.engagedViews, range),
      previousPeriodComparison(typeKpis.likes, range),
      previousPeriodComparison(typeKpis.subscribers, range),
    ]
    assert.ok(
      typeNotes.every((note) => typeof note === 'string' && note.length > 0),
      `${range.kind} content filters must retain all KPI comparison descriptions`,
    )
  }
}
const contentMetricImpressions = analytics.content.metricSeries.reduce(
  (sum, row) => sum + row.impressions,
  0,
)
const contentMetricEngagedViews = analytics.content.metricSeries.reduce(
  (sum, row) => sum + row.engagedViews,
  0,
)
const contentMetricLikes = analytics.content.metricSeries.reduce(
  (sum, row) => sum + row.likes,
  0,
)
assert.equal(
  Math.round(contentMetricImpressions),
  analytics.content.kpis.impressions.value,
  'content impression chart must reconcile to its KPI',
)
assert.equal(
  Math.round(contentMetricEngagedViews),
  analytics.content.kpis.engagedViews.value,
  'content engaged-view chart must reconcile to its KPI',
)
assert.equal(
  Math.round(contentMetricLikes),
  analytics.content.kpis.likes.value,
  'content likes chart must reconcile to its KPI',
)
assert.equal(
  analytics.content.kpis.subscribers.value,
  analytics.overview.kpis.subscribers.value,
  'content and overview subscriber KPIs must use the same stored history',
)
assert.ok(
  analytics.content.metricSeries.every((row) => (
    Number.isFinite(row.ctr)
    && row.ctr >= 0
    && Number.isFinite(row.averageViewDuration)
    && row.averageViewDuration >= 0
    && Number.isFinite(row.engagedViews)
    && row.engagedViews >= 0
    && Number.isFinite(row.likes)
    && row.likes >= 0
  )),
  'all switchable content series must contain valid chart values',
)
assert.ok(
  analytics365Days.content.metricSeries.every((row) => (
    Number.isFinite(row.impressions)
    && Number.isFinite(row.ctr)
    && Number.isFinite(row.averageViewDuration)
    && Number.isFinite(row.engagedViews)
    && Number.isFinite(row.likes)
  )),
  'monthly content metric buckets must preserve all switchable chart fields',
)
assert.deepEqual(
  Object.keys(analytics.content.kpisByType).sort(),
  ['live', 'post', 'short', 'video'],
  'content type filters must expose the same KPI schema',
)
assert.ok(
  Object.values(analytics.content.kpisByType).every((typeKpis) => (
    ['views', 'engagedViews', 'likes', 'subscribers'].every((key) => (
      Number.isFinite(typeKpis[key].value)
      && typeKpis[key].value >= 0
    ))
  )),
  'each content type must expose nonnegative dynamic KPIs',
)
const boundedInteractionVideo = {
  ...oldVideo,
  id: 'bounded-interactions',
  date: '2026-04-15',
  views: 10_000,
  likes: 10_000,
  averageViewPercentage: 100,
}
const boundedInteractionDaily = build(
  [boundedInteractionVideo],
  channel,
  { kind: '28d' },
  { today },
)
const boundedInteractionBuckets = build(
  [boundedInteractionVideo],
  channel,
  { kind: '365d' },
  { today },
)
for (const result of [boundedInteractionDaily, boundedInteractionBuckets]) {
  assert.ok(
    result.content.metricSeries.every((row) => (
      row.engagedViews <= row.views && row.likes <= row.views
    )),
    'daily and bucketed interactions must not exceed their source views',
  )
}
const boundedInteractionLifetime = build(
  [boundedInteractionVideo],
  channel,
  { kind: 'lifetime' },
  { today },
)
assert.equal(
  boundedInteractionLifetime.content.kpis.engagedViews.value,
  boundedInteractionVideo.views,
  'lifetime engaged views must reconcile exactly to their source total',
)
assert.equal(
  boundedInteractionLifetime.content.kpis.likes.value,
  boundedInteractionVideo.likes,
  'lifetime likes must reconcile exactly to their source total',
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
  Number.POSITIVE_INFINITY,
  'lifetime KPIs must expose an open-ended comparison when the previous period is empty',
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
const manuallyAdjustedInteractions = normalizeVideo({
  ...oldVideo,
  likes: 321,
  dislikes: 17,
})
const interactionsAfterViewsChange = normalizeVideo(
  { views: oldVideo.views + 5_000 },
  { base: manuallyAdjustedInteractions },
)
assert.equal(
  interactionsAfterViewsChange.likes,
  321,
  'changing views must preserve the independently stored likes total',
)
assert.equal(
  interactionsAfterViewsChange.dislikes,
  17,
  'changing views must preserve the independently stored dislikes total',
)
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
assert.equal(
  subscriberAnalytics.content.kpis.subscribers.value,
  subscriberAnalytics.overview.kpis.subscribers.value,
  'content should use the same subscriber KPI for the all-content filter',
)
assert.deepEqual(
  subscriberAnalytics.content.subscribers,
  subscriberAnalytics.audience.subscribers,
  'content subscriber chart should use the stored daily subscriber series',
)
const oneSubscriberChannel = {
  ...subscriberChannel,
  subscriberDailyStats: [{ date: '2026-05-08', gained: 1, lost: 0 }],
}
const equalTypeVideos = ['video', 'short', 'live'].map((type) => ({
  ...oldVideo,
  id: 'equal-allocation-video',
  type,
}))
const typedSubscriberAnalytics = build(
  equalTypeVideos,
  oneSubscriberChannel,
  { kind: '7d' },
  { today },
)
const contentTypeKeys = ['video', 'short', 'live', 'post']
assert.equal(
  contentTypeKeys.reduce(
    (sum, key) => sum + typedSubscriberAnalytics.content.kpisByType[key].subscribers.value,
    0,
  ),
  typedSubscriberAnalytics.content.kpis.subscribers.value,
  'type subscriber KPIs must reconcile exactly to the all-content KPI',
)
for (const key of contentTypeKeys) {
  assert.equal(
    typedSubscriberAnalytics.content.subscribersByType[key]
      .reduce((sum, row) => sum + row.subscribers, 0),
    typedSubscriberAnalytics.content.kpisByType[key].subscribers.value,
    `${key} subscriber chart must reconcile exactly to its KPI`,
  )
}
typedSubscriberAnalytics.content.subscribers.forEach((row, index) => {
  assert.equal(
    contentTypeKeys.reduce(
      (sum, key) => (
        sum
        + typedSubscriberAnalytics.content.subscribersByType[key][index].subscribers
      ),
      0,
    ),
    row.subscribers,
    `type subscriber allocation must reconcile on ${row.date}`,
  )
})

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

const adaptiveSubscriberRows = isoDatesEndingAt('2026-05-11', 56).map(
  (date, index) => ({
    date,
    gained: index < 28 ? 100 : 120,
    lost: 0,
  }),
)
const adaptiveSubscriberTotal = adaptiveSubscriberRows.reduce(
  (sum, row) => sum + row.gained,
  0,
)
const adaptiveSubscribersBefore = build(
  [],
  {
    ...channel,
    subscriberCount: adaptiveSubscriberTotal,
    subscriberDailyStats: adaptiveSubscriberRows,
  },
  { kind: '28d' },
  { today },
)
const reconciledSubscriberRows = reconcileSubscriberHistoryToTotal(
  adaptiveSubscriberRows,
  adaptiveSubscriberTotal + 1_400,
)
const adaptiveSubscribersAfter = build(
  [],
  {
    ...channel,
    subscriberCount: adaptiveSubscriberTotal + 1_400,
    subscriberDailyStats: reconciledSubscriberRows,
  },
  { kind: '28d' },
  { today },
)
assert.equal(
  reconciledSubscriberRows.reduce((sum, row) => sum + row.gained, 0),
  adaptiveSubscriberTotal + 1_400,
  'subscriber reconciliation must exactly match the edited channel total',
)
assert.ok(
  reconciledSubscriberRows.slice(0, 28).reduce((sum, row) => sum + row.gained, 0) > 0,
  'a subscriber increase may rebalance but must preserve the previous comparison period',
)
assert.notEqual(
  Math.round(adaptiveSubscribersAfter.overview.kpis.subscribers.delta),
  Math.round(adaptiveSubscribersBefore.overview.kpis.subscribers.delta),
  'editing subscriber count must recalculate the subscriber comparison',
)
assert.deepEqual(
  reconcileSubscriberHistoryToTotal(
    adaptiveSubscriberRows,
    adaptiveSubscriberTotal + 1_400,
  ),
  reconciledSubscriberRows,
  'subscriber reconciliation must be deterministic',
)
const reducedSubscriberRows = reconcileSubscriberHistoryToTotal(
  adaptiveSubscriberRows,
  500,
)
assert.equal(
  reducedSubscriberRows.reduce((sum, row) => sum + row.gained, 0),
  500,
  'subscriber reductions must also reconcile exactly',
)
assert.ok(
  reducedSubscriberRows.every((row) => row.gained >= 0 && row.lost === 0),
  'subscriber reconciliation must remain positive-only',
)
const reducedSubscriberAnalytics = build(
  [],
  {
    ...channel,
    subscriberCount: 500,
    subscriberDailyStats: reducedSubscriberRows,
  },
  { kind: '28d' },
  { today },
)
const reducedOverviewSubscribers = reducedSubscriberAnalytics.overview.kpis.subscribers
assert.ok(
  reducedOverviewSubscribers.value > 0,
  'a large subscriber reduction must not erase the current 28-day KPI',
)
assert.ok(
  reducedOverviewSubscribers.previousValue > 0,
  'a large subscriber reduction must preserve the previous comparison period',
)
assert.notEqual(
  Math.round(reducedOverviewSubscribers.delta),
  -100,
  'a large subscriber reduction must not render a false 100% collapse',
)
assert.equal(
  reducedSubscriberAnalytics.content.kpis.subscribers.value,
  reducedOverviewSubscribers.value,
  'overview and content must show the same subscriber KPI after a reduction',
)
assert.equal(
  reducedSubscriberAnalytics.audience.kpis.subscribers.value,
  reducedOverviewSubscribers.value,
  'overview and audience must show the same subscriber KPI after a reduction',
)

const alternateReducedSubscriberRows = reconcileSubscriberHistoryToTotal(
  adaptiveSubscriberRows,
  3_000,
)
const alternateReducedSubscriberAnalytics = build(
  [],
  {
    ...channel,
    subscriberCount: 3_000,
    subscriberDailyStats: alternateReducedSubscriberRows,
  },
  { kind: '28d' },
  { today },
)
assert.notEqual(
  Math.round(alternateReducedSubscriberAnalytics.overview.kpis.subscribers.delta),
  Math.round(reducedOverviewSubscribers.delta),
  'different edited subscriber totals must produce different visible comparisons',
)

const collapsedExactTargetRows = adaptiveSubscriberRows.map((row, index) => ({
  ...row,
  gained: index < 28 ? 100 : 0,
}))
const collapsedExactTarget = collapsedExactTargetRows.reduce(
  (sum, row) => sum + row.gained,
  0,
)
assert.equal(
  collapsedExactTargetRows.slice(-28).reduce((sum, row) => sum + row.gained, 0),
  0,
  'the collapsed-history fixture must start with an empty current period',
)
assert.ok(
  collapsedExactTargetRows.slice(0, 28).reduce((sum, row) => sum + row.gained, 0) > 0,
  'the collapsed-history fixture must retain a populated previous period',
)
const repairedCollapsedSubscriberRows = reconcileSubscriberHistoryToTotal(
  collapsedExactTargetRows,
  collapsedExactTarget,
)
assert.equal(
  repairedCollapsedSubscriberRows.reduce((sum, row) => sum + row.gained, 0),
  collapsedExactTarget,
  'repairing collapsed history must preserve the exact authoritative total',
)
assert.ok(
  repairedCollapsedSubscriberRows.slice(-28).reduce((sum, row) => sum + row.gained, 0) > 0,
  'exact-target reconciliation must restore the current 28-day period',
)
assert.ok(
  repairedCollapsedSubscriberRows.slice(0, 28).reduce((sum, row) => sum + row.gained, 0) > 0,
  'exact-target reconciliation must preserve the previous 28-day period',
)

const editedSubscriberSourceTotal = 45_534
const editedSubscriberTargetTotal = 69_504
const editedSubscriberDates = isoDatesEndingAt('2026-05-11', 365)
const editedSubscriberSourceRows = allocateSubscriberHistory(
  editedSubscriberSourceTotal,
  editedSubscriberDates,
)
const editedSubscriberRows = reconcileSubscriberHistoryToTotal(
  editedSubscriberSourceRows,
  editedSubscriberTargetTotal,
)
const editedSubscriberLifetime = editedSubscriberRows.reduce(
  (sum, row) => sum + row.gained,
  0,
)
const editedSubscriberCurrentRows = editedSubscriberRows.slice(-28)
const editedSubscriberPreviousRows = editedSubscriberRows.slice(-56, -28)
const editedSubscriberCurrentTotal = editedSubscriberCurrentRows.reduce(
  (sum, row) => sum + row.gained,
  0,
)
const editedSubscriberPreviousTotal = editedSubscriberPreviousRows.reduce(
  (sum, row) => sum + row.gained,
  0,
)
const editedSubscriberCurrentAverage = editedSubscriberCurrentTotal
  / editedSubscriberCurrentRows.length

assert.equal(
  editedSubscriberLifetime,
  editedSubscriberTargetTotal,
  'editing subscriber total from 45,534 to 69,504 must reconcile lifetime exactly',
)
assert.ok(
  editedSubscriberCurrentTotal > 0,
  'the 69,504 total must keep the current 28-day subscriber KPI positive',
)
assert.ok(
  editedSubscriberPreviousTotal > 0,
  'the 69,504 total must keep the previous 28-day comparison positive',
)
assert.ok(
  editedSubscriberCurrentTotal <= editedSubscriberTargetTotal * 0.15,
  'the current 28-day KPI must remain at most 15% of the lifetime total',
)
assert.ok(
  Math.max(...editedSubscriberCurrentRows.map((row) => row.gained))
    <= editedSubscriberCurrentAverage * 3,
  'no current subscriber day may exceed three times its 28-day average',
)
assert.ok(
  Math.abs(editedSubscriberCurrentTotal - 39_000) > 5_000,
  'the current 28-day KPI must not inflate to roughly 39 thousand',
)

const editedSubscriberAnalytics = build(
  [],
  {
    ...channel,
    subscriberCount: editedSubscriberTargetTotal,
    subscriberDailyStats: editedSubscriberRows,
  },
  { kind: '28d' },
  { today },
)
const alternateEditedSubscriberTotal = 100_000
const alternateEditedSubscriberRows = reconcileSubscriberHistoryToTotal(
  editedSubscriberSourceRows,
  alternateEditedSubscriberTotal,
)
const alternateEditedSubscriberAnalytics = build(
  [],
  {
    ...channel,
    subscriberCount: alternateEditedSubscriberTotal,
    subscriberDailyStats: alternateEditedSubscriberRows,
  },
  { kind: '28d' },
  { today },
)
assert.notEqual(
  Math.round(editedSubscriberAnalytics.overview.kpis.subscribers.delta),
  Math.round(alternateEditedSubscriberAnalytics.overview.kpis.subscribers.delta),
  'different realistic subscriber totals must produce different visible comparisons',
)

const inflatedExactTarget = 69_504
const inflatedCurrentTarget = Math.ceil(inflatedExactTarget * 0.3)
const inflatedExactTargetRows = [
  ...allocateSubscriberHistory(
    inflatedExactTarget - inflatedCurrentTarget,
    editedSubscriberDates.slice(0, -28),
  ),
  ...allocateSubscriberHistory(
    inflatedCurrentTarget,
    editedSubscriberDates.slice(-28),
  ),
]
assert.equal(
  inflatedExactTargetRows.reduce((sum, row) => sum + row.gained, 0),
  inflatedExactTarget,
  'the inflated-history fixture must already equal the authoritative total',
)
assert.ok(
  inflatedExactTargetRows.slice(-28).reduce((sum, row) => sum + row.gained, 0)
    > inflatedExactTarget * 0.25,
  'the inflated-history fixture must put more than 25% in the current period',
)
assert.ok(
  inflatedExactTargetRows.slice(-56, -28).reduce((sum, row) => sum + row.gained, 0) > 0,
  'the inflated-history fixture must retain a populated previous period',
)

const repairedInflatedSubscriberRows = reconcileSubscriberHistoryToTotal(
  inflatedExactTargetRows,
  inflatedExactTarget,
)
assert.equal(
  repairedInflatedSubscriberRows.reduce((sum, row) => sum + row.gained, 0),
  inflatedExactTarget,
  'equal-target inflated history repair must preserve the exact total',
)
assert.ok(
  repairedInflatedSubscriberRows.slice(-28).reduce((sum, row) => sum + row.gained, 0)
    <= inflatedExactTarget * 0.1,
  'equal-target reconciliation must reduce the current period to at most 10%',
)
assert.ok(
  repairedInflatedSubscriberRows.slice(-56, -28)
    .reduce((sum, row) => sum + row.gained, 0) > 0,
  'equal-target inflated history repair must preserve the previous period',
)

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
const current28SubscriberTotal = smoothSubscriberValues.slice(-28)
  .reduce((sum, value) => sum + value, 0)
const previous28SubscriberTotal = smoothSubscriberValues.slice(-56, -28)
  .reduce((sum, value) => sum + value, 0)
const adjacentPeriodRatio = current28SubscriberTotal / previous28SubscriberTotal

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
  Math.min(...smoothSubscriberValues) >= smoothSubscriberAverage * 0.35,
  'the slow regime must keep every daily gain inside its lower safety bound',
)
assert.ok(
  Math.max(...smoothSubscriberValues) <= smoothSubscriberAverage * 1.9,
  'the slow regime must keep every daily gain inside its upper safety bound',
)
assert.ok(
  smoothSubscriberValues.every((value, index) => (
    index === 0
    || Math.abs(value - smoothSubscriberValues[index - 1]) <= smoothSubscriberAverage * 0.2
  )),
  'adjacent completed days must change gradually',
)
assert.ok(
  adjacentPeriodRatio > 1.4 && adjacentPeriodRatio < 2,
  'adjacent 28-day periods must differ meaningfully without a one-day spike',
)
assert.ok(
  Math.abs(subscriberHistoryWeight('2026-07-27') - 1.5515838998804317) < 1e-12,
  'the JS reference must match the SQL epoch and channel phase',
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
  Math.min(...boundedManualValues) >= smoothSubscriberAverage * 0.35
    && Math.max(...boundedManualValues) <= smoothSubscriberAverage * 1.9,
  'admin adjustments must remain inside the same safe daily envelope',
)

const rescaledSubscriberHistory = allocateSubscriberHistory(
  2_000_000,
  smoothSubscriberDates,
)
const rescaledValues = rescaledSubscriberHistory.map((row) => row.gained)
const rescaledAdjacentRatio = (
  rescaledValues.slice(-28).reduce((sum, value) => sum + value, 0)
  / rescaledValues.slice(-56, -28).reduce((sum, value) => sum + value, 0)
)
assert.ok(
  Math.abs(rescaledAdjacentRatio - adjacentPeriodRatio) < 0.001,
  'changing the channel total must rescale the same stable history shape',
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
