import assert from 'node:assert/strict'

import { build } from '../src/lib/analyticsAggregator.js'
import {
  generateLifecycleShape,
  hashSeed,
  normalizeToTotal,
} from '../src/lib/analyticsEngine.js'
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

const normalized = normalizeToTotal(lifecycle, oldStats.views)
assert.equal(Math.round(normalized.reduce((sum, value) => sum + value, 0)), oldStats.views)

console.log('analytics lifecycle verification passed')
