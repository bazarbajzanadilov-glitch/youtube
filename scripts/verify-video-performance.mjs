import assert from 'node:assert/strict'
import {
  buildCumulativeCurve,
  buildPerformanceSectionView,
  buildSincePublicationXAxis,
  buildSincePublicationYTicks,
  daysSincePublication,
  defaultPublishedAt,
  normalizePerformanceSection,
  normalizePerformanceSections,
  videoAnalyticsRoute,
} from '../src/lib/videoPerformanceSection.js'
import {
  declineDaysLabel,
  declineTimes,
  formatAxisCompact,
  formatCompactOneDecimal,
} from '../src/lib/analyticsFormat.js'

const NBSP = ' '
const today = new Date('2026-09-22T12:00:00+05:00')

// Ось X — ровно как на скриншотах клиента.
assert.deepEqual(buildSincePublicationXAxis(630).ticks, [0, 105, 210, 315, 420, 525, 630])
assert.deepEqual(buildSincePublicationXAxis(36).ticks, [0, 6, 12, 18, 24, 30, 36])
assert.deepEqual(buildSincePublicationXAxis(534).ticks, [0, 89, 178, 267, 356, 445, 534])
assert.deepEqual(buildSincePublicationXAxis(1386).ticks, [0, 231, 462, 693, 924, 1155, 1386])
assert.deepEqual(buildSincePublicationXAxis(8), { step: 2, lastTick: 12, ticks: [0, 2, 4, 6, 8, 10, 12] })
assert.equal(buildSincePublicationXAxis(0).step, 1, 'нулевой возраст даёт минимальный шаг')

// Ось Y — четыре отметки с «красивым» шагом YouTube.
assert.deepEqual(buildSincePublicationYTicks(2_200_000), [0, 750_000, 1_500_000, 2_250_000])
assert.deepEqual(buildSincePublicationYTicks(370_000), [0, 125_000, 250_000, 375_000])
assert.deepEqual(buildSincePublicationYTicks(81_022_050), [0, 30_000_000, 60_000_000, 90_000_000])
assert.deepEqual(buildSincePublicationYTicks(5_942_494), [0, 2_000_000, 4_000_000, 6_000_000])
assert.deepEqual(buildSincePublicationYTicks(0), [0, 1, 2, 3])
assert.deepEqual(buildSincePublicationYTicks(3), [0, 1, 2, 3])

// Подписи.
assert.equal(formatAxisCompact(2_000_000), `2${NBSP}млн`)
assert.equal(formatAxisCompact(2_250_000), `2,3${NBSP}млн`)
assert.equal(formatAxisCompact(1_500_000), `1,5${NBSP}млн`)
assert.equal(formatAxisCompact(750_000), `750${NBSP}тыс.`)
assert.equal(formatAxisCompact(0), '0')
assert.equal(formatCompactOneDecimal(81_022_050), `81,0${NBSP}млн`)
assert.equal(formatCompactOneDecimal(5_942_494), `5,9${NBSP}млн`)
assert.equal(formatCompactOneDecimal(2_170_019), `2,2${NBSP}млн`, 'округление как в YouTube')
assert.equal(formatCompactOneDecimal(254_100), `254,1${NBSP}тыс.`)
assert.equal(declineTimes(5_942_494), 'раза')
assert.equal(declineTimes(81_022_050), 'раз')
assert.equal(declineTimes(1), 'раз')
assert.equal(declineTimes(12), 'раз')
assert.equal(declineTimes(23), 'раза')
assert.equal(declineDaysLabel(1386), '1386 дней')
assert.equal(declineDaysLabel(21), '21 день')
assert.equal(declineDaysLabel(3), '3 дня')
assert.equal(declineDaysLabel(11), '11 дней')

// Кривая: монотонная, начинается с 0, заканчивается ровно total, детерминирована.
for (const shape of ['burst', 'gradual', 'even']) {
  const curve = buildCumulativeCurve({ days: 1386, total: 5_942_494, shape, seed: 42 })
  assert.equal(curve.length, 1387)
  assert.equal(curve[0], 0)
  assert.equal(curve[1386], 5_942_494)
  for (let index = 1; index < curve.length; index += 1) {
    assert.ok(curve[index] >= curve[index - 1], `кривая ${shape} должна быть неубывающей`)
  }
  assert.deepEqual(curve, buildCumulativeCurve({ days: 1386, total: 5_942_494, shape, seed: 42 }))
}
const burst = buildCumulativeCurve({ days: 630, total: 81_022_050, shape: 'burst', seed: 7 })
assert.ok(burst[32] / 81_022_050 > 0.5, 'резкий старт: больше половины просмотров за первые 5 % дней')
assert.ok(burst[315] / 81_022_050 > 0.85, 'резкий старт: плато к середине периода')
const even = buildCumulativeCurve({ days: 630, total: 81_022_050, shape: 'even', seed: 7 })
assert.ok(Math.abs(even[315] / 81_022_050 - 0.5) < 0.12, 'равномерный рост: около половины к середине')
assert.deepEqual(buildCumulativeCurve({ days: 5, total: 0, shape: 'burst', seed: 1 }), [0, 0, 0, 0, 0, 0])

// Нормализация и дефолты.
const fallback = normalizePerformanceSection('shorts', { totalViews: 'мусор', publishedAt: 'нет', curveShape: 'zigzag' })
assert.equal(fallback.variant, 'shorts')
assert.equal(fallback.totalViews, 81_022_050)
assert.equal(fallback.curveShape, 'burst')
assert.match(fallback.publishedAt, /^\d{4}-\d{2}-\d{2}$/)
const both = normalizePerformanceSections({ video: { totalViews: '10' } })
assert.deepEqual(Object.keys(both).sort(), ['shorts', 'video'])
assert.equal(both.video.totalViews, 10)
assert.equal(both.shorts.totalViews, 81_022_050)
assert.equal(normalizePerformanceSection('nope', {}).variant, 'video')
assert.equal(videoAnalyticsRoute({ type: 'short' }), 'video-analytics/shorts')
assert.equal(videoAnalyticsRoute({ type: 'video' }), 'video-analytics/video')
assert.equal(videoAnalyticsRoute(null), 'video-analytics/video')

// Дни с публикации считаются по Алматы, дата по умолчанию даёт ровно нужный возраст.
assert.equal(defaultPublishedAt(630, today), '2024-12-31')
assert.equal(daysSincePublication('2024-12-31', today), 630)
assert.equal(daysSincePublication('2026-09-22', today), 1, 'сегодняшняя публикация — минимум один день')
assert.equal(daysSincePublication(null, today), 1)

// Полное представление раздела.
const view = buildPerformanceSectionView({
  variant: 'video',
  publishedAt: defaultPublishedAt(1386, today),
  totalViews: 5_942_494,
  typicalViews: 120_000,
  watchHours: 254_100,
  typicalWatchHours: 1_400,
  subscribersGained: 14_900,
  revenueTenge: 7_365.63,
  curveShape: 'burst',
}, today)
assert.equal(view.days, 1386)
assert.deepEqual(view.xAxis.ticks, [0, 231, 462, 693, 924, 1155, 1386])
assert.deepEqual(view.yTicks, [0, 2_000_000, 4_000_000, 6_000_000])
assert.deepEqual(view.yDomain, [0, 6_000_000])
assert.equal(view.chartData.length, 1387)
assert.equal(view.chartData[0].views, 0)
assert.equal(view.chartData[1386].views, 5_942_494)
assert.equal(view.chartData[1386].viewsTypical, 120_000)
assert.equal(view.chartData[0].date, defaultPublishedAt(1386, today))
assert.equal(view.chartData[1386].date, '2026-09-21', 'последняя точка — последний полный день')

// Ось заканчивается на 6 × шаг, а линия — на реальном дне (дальше null).
const padded = buildPerformanceSectionView({
  variant: 'shorts',
  publishedAt: defaultPublishedAt(8, today),
  totalViews: 1_000,
}, today)
assert.equal(padded.days, 8)
assert.equal(padded.xAxis.lastTick, 12)
assert.equal(padded.chartData.length, 13)
assert.equal(padded.chartData[8].views, 1_000)
assert.equal(padded.chartData[9].views, null)
assert.equal(padded.chartData[12].viewsTypical, null)

// Не зависит ни от какого диапазона аналитики: та же секция → тот же результат.
assert.deepEqual(
  buildPerformanceSectionView(view.section, today),
  buildPerformanceSectionView({ ...view.section }, today),
)

console.log('video performance verification passed')

// Карточка «Текущая статистика».
import { buildRealtimeBars } from '../src/lib/videoPerformanceSection.js'
const bars = buildRealtimeBars(59_355, 3)
assert.equal(bars.length, 48)
assert.equal(bars.reduce((a, b) => a + b, 0), 59_355)
assert.deepEqual(bars, buildRealtimeBars(59_355, 3))
const rt = buildPerformanceSectionView({ variant: 'video', realtimeViews48h: 1_000 }, today).realtime
assert.equal(rt.total, 1_000)
assert.equal(rt.sources.length, 5)
assert.equal(rt.sources[0].label, 'Плейлисты')
assert.equal(rt.sources[0].spark.length, 8)
const custom = normalizePerformanceSection('shorts', { trafficSources: [{ label: ' Внешние ', percent: 150 }, { label: '', percent: 5 }] })
assert.deepEqual(custom.trafficSources, [{ label: 'Внешние', percent: 100 }])
console.log('realtime card verification passed')

// Отдельная аналитика каждого видео — из движка аналитики канала.
import { buildVideoPerformanceView, videoIdFromAnalyticsRoute } from '../src/lib/videoPerformanceSection.js'
assert.equal(videoAnalyticsRoute({ id: 'abc 1', type: 'video' }), 'video-analytics/v/abc%201')
assert.equal(videoIdFromAnalyticsRoute('video-analytics/v/abc%201'), 'abc 1')
assert.equal(videoIdFromAnalyticsRoute('video-analytics/video'), null)
const vids = [
  { id: 'a', date: '2026-09-10', views: 300, revenue: 2, type: 'video', duration: '10:00' },
  { id: 'b', date: '2026-09-05', views: 900, revenue: 6, type: 'video', duration: '8:00' },
  { id: 's', date: '2026-09-01', views: 5000, revenue: 1, type: 'short', duration: '0:30' },
]
const rows = []
for (const v of vids) {
  const days = Math.round((Date.parse('2026-09-21') - Date.parse(v.date)) / 86400000) + 1
  for (let d = 0; d < days; d += 1) {
    const date = new Date(Date.parse(v.date) + d * 86400000).toISOString().slice(0, 10)
    const share = Math.floor(v.views / days) + (d < v.views % days ? 1 : 0)
    rows.push({ videoId: v.id, date, views: share, watchSeconds: share * 60, revenue: v.revenue / days })
  }
}
const ch = { channelName: 'Test', videoDailyStats: rows, subscriberDailyStats: [{ date: '2026-09-12', gained: 100, lost: 0 }] }
const va = buildVideoPerformanceView(vids[0], vids, ch, today)
const vb = buildVideoPerformanceView(vids[1], vids, ch, today)
assert.equal(va.kpis.views, 300, 'просмотры видео = его дневная история')
assert.equal(vb.kpis.views, 900)
assert.equal(va.chartData[va.days].views, 300)
assert.equal(va.kpis.typicalViews, vb.chartData[va.days].views, 'обычные = медиана роликов того же типа в том же возрасте')
assert.equal(Math.round(va.kpis.watchHours * 60), 300, 'время просмотра из watchSeconds')
assert.ok(va.kpis.subscribers > 0 && va.kpis.subscribers < 100, 'подписчики — доля ролика в приросте канала')
assert.equal(buildVideoPerformanceView(vids[2], vids, ch, today).variant, 'shorts')
assert.ok(va.realtime.sources.length > 0 && va.realtime.sources.every((x) => x.percent > 0))
assert.equal(va.chartData[va.days].watch, va.kpis.watchHours, 'график времени просмотра заканчивается на KPI')
assert.equal(va.chartData[va.days].subscribers, va.kpis.subscribers)
assert.equal(Math.round(va.chartData[va.days].revenue), Math.round(va.kpis.revenueTenge))
assert.equal(vb.chartData[va.days + 1].viewsTypical, va.kpis.views, 'ролик моложе берётся с его текущим итогом')
assert.ok(vb.chartData[va.days].viewsTypical > 0)
for (const key of ['views', 'watch', 'subscribers', 'revenue']) {
  assert.equal(vb.yTicksByMetric[key].length, 4)
  assert.ok(vb.yTicksByMetric[key][3] >= vb.chartData[vb.days][key], `ось ${key} вмещает значение`)
}
console.log('per-video analytics verification passed')

// Самый старый ролик сравнивается с текущими итогами остальных; первые сутки — «обрабатывается»; без монетизации — 0 ₸.
assert.equal(vb.kpis.typicalViews, va.kpis.views, 'у самого старого ролика «обычное» — итог более молодых роликов')
const fresh = buildVideoPerformanceView({ id: 'new', date: '2026-09-22', views: 50, type: 'video' }, vids, ch, today)
assert.equal(fresh.pending, true)
const noMoney = buildVideoPerformanceView(vids[0], vids, { ...ch, monetizationEnabled: false }, today)
assert.equal(noMoney.kpis.revenueTenge, 0)
console.log('edge cases verification passed')
