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
import { generateVideoStats } from '../src/storage/videoStore.js'

const today = new Date('2026-05-12T12:00:00')
const channel = {
  channelName: 'inside-trading',
  country: 'RU',
  subscriberCount: 12000,
  monetizationEnabled: true,
}

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
  profile: 'decayAfterPeak',
}
const analytics = build([oldVideo], channel, { kind: '28d' }, { today })
const revenueSeries = analytics.overview.series.map((d) => d.revenue)
const totalRevenue = revenueSeries.reduce((sum, value) => sum + value, 0)
const nonZeroRevenueDays = revenueSeries.filter((value) => value > 0).length
const maxRevenueDay = Math.max(...revenueSeries)

assert.ok(nonZeroRevenueDays > 10, 'revenue should be distributed across many days')
assert.ok(maxRevenueDay / totalRevenue < 0.35, 'revenue should not be concentrated in one day')

const futureVideo = {
  ...oldVideo,
  id: 'future-video',
  date: '2026-05-20',
}
const futureAnalytics = build([futureVideo], channel, { kind: '7d' }, { today })
assert.equal(futureAnalytics.overview.kpis.views.value, 0, 'future videos should not contribute views')
assert.equal(futureAnalytics.monetization.kpis.revenue.value, 0, 'future videos should not contribute revenue')

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

assert.equal(positiveSubscriberDay.subscribers, 3, 'gained=5 and lost=2 should produce +3')
assert.equal(negativeSubscriberDay.subscribers, -3, 'gained=1 and lost=4 should produce -3 without clipping')
assert.equal(subscriberAnalytics.overview.kpis.subscribers.value, 2, 'period KPI should sum every daily net change')
assert.equal(subscriberAnalytics.overview.kpis.subscribers.gained, 8)
assert.equal(subscriberAnalytics.overview.kpis.subscribers.lost, 6)
assert.equal(
  subscriberAnalytics.overview.kpis.subscribers.value,
  subscriberAnalytics.audience.kpis.subscribers.value,
  'overview and audience should use the same subscriber KPI',
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
  { date: '2026-05-08', gained: 5, lost: 2, subscribers: 3 },
  { date: '2026-05-09', gained: 1, lost: 4, subscribers: -3 },
  { date: '2026-05-11', gained: 0, lost: 0, subscribers: 0 },
])

const subscriberBucketsSource = [
  { date: '2026-01-31', gained: 5, lost: 2, subscribers: 3 },
  { date: '2026-02-01', gained: 1, lost: 4, subscribers: -3 },
  { date: '2026-02-02', gained: 2, lost: 0, subscribers: 2 },
]
assert.deepEqual(aggregateSubscriberSeries(subscriberBucketsSource, 'week'), [
  { date: '2026-01-26', gained: 6, lost: 6, subscribers: 0 },
  { date: '2026-02-02', gained: 2, lost: 0, subscribers: 2 },
])
assert.deepEqual(aggregateSubscriberSeries(subscriberBucketsSource, 'month'), [
  { date: '2026-01-01', gained: 5, lost: 2, subscribers: 3 },
  { date: '2026-02-01', gained: 3, lost: 4, subscribers: -1 },
])

console.log('analytics lifecycle verification passed')
