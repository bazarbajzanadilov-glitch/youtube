/**
 * Раздел «С момента публикации» — статистика одного видео (Shorts / обычное),
 * как на странице аналитики видео в YouTube Studio.
 *
 * Данные раздела вводятся в админке и не зависят от диапазона аналитики канала.
 * Кривая графика генерируется детерминированно из введённых чисел.
 */

import { addDays, daysBetween, hashSeed, isoDay, seededRng } from './analyticsEngine.js'
import { getAlmatyDateISO } from './almatyDate.js'
import { buildVideoLifetimeAnalytics } from './analyticsAggregator.js'

const TENGE_PER_DOLLAR = 512

export const PERFORMANCE_VARIANTS = ['shorts', 'video']

export const CURVE_SHAPES = [
  { value: 'burst', label: 'Резкий старт и плато' },
  { value: 'gradual', label: 'Плавный рост' },
  { value: 'even', label: 'Равномерный рост' },
]

export const DEFAULT_TRAFFIC_SOURCES = [
  { label: 'Плейлисты', percent: 48.1 },
  { label: 'Функции выбора контента', percent: 17.3 },
  { label: 'Рекомендованные видео', percent: 9.7 },
  { label: 'Поиск на YouTube', percent: 6.4 },
  { label: 'Адресная строка, закладки и т. п.', percent: 2.1 },
]
const MAX_TRAFFIC_SOURCES = 5
const REALTIME_HOURS = 48

const CURVE_SHAPE_VALUES = CURVE_SHAPES.map((shape) => shape.value)
const X_TICK_COUNT = 7
const Y_TICK_COUNT = 4
const Y_NICE_STEPS = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5]

export function defaultPublishedAt(daysAgo, now = new Date()) {
  return isoDay(addDays(getAlmatyDateISO(now), -Math.max(0, Math.round(daysAgo))))
}

export function buildDefaultPerformanceSections(now = new Date()) {
  return {
    shorts: {
      variant: 'shorts',
      publishedAt: defaultPublishedAt(630, now),
      totalViews: 81_022_050,
      typicalViews: 0,
      watchHours: 0,
      typicalWatchHours: 0,
      subscribersGained: 204_300,
      revenueTenge: 1_253_155.42,
      curveShape: 'burst',
      realtimeViews48h: 59_355,
      trafficSources: DEFAULT_TRAFFIC_SOURCES,
    },
    video: {
      variant: 'video',
      publishedAt: defaultPublishedAt(1386, now),
      totalViews: 5_942_494,
      typicalViews: 0,
      watchHours: 254_100,
      typicalWatchHours: 1_400,
      subscribersGained: 14_900,
      revenueTenge: 7_365.63,
      curveShape: 'burst',
      realtimeViews48h: 59_355,
      trafficSources: DEFAULT_TRAFFIC_SOURCES,
    },
  }
}

export const DEFAULT_PERFORMANCE_SECTIONS = buildDefaultPerformanceSections()

function nonNegativeNumber(value, fallback = 0) {
  if (value == null || value === '') return fallback
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) return fallback
  return number
}

function isoDate(value) {
  const text = String(value || '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null
}

function normalizeTrafficSources(value, fallback) {
  if (!Array.isArray(value)) return fallback
  return value
    .filter((item) => item && typeof item === 'object' && String(item.label || '').trim())
    .slice(0, MAX_TRAFFIC_SOURCES)
    .map((item) => ({
      label: String(item.label).trim(),
      percent: Math.min(100, Math.round(nonNegativeNumber(item.percent, 0) * 10) / 10),
    }))
}

export function normalizePerformanceSection(variant, raw = {}) {
  const key = PERFORMANCE_VARIANTS.includes(variant) ? variant : 'video'
  const fallback = DEFAULT_PERFORMANCE_SECTIONS[key]
  const source = raw && typeof raw === 'object' ? raw : {}
  const curveShape = CURVE_SHAPE_VALUES.includes(source.curveShape) ? source.curveShape : fallback.curveShape
  return {
    variant: key,
    publishedAt: isoDate(source.publishedAt) || fallback.publishedAt,
    totalViews: Math.round(nonNegativeNumber(source.totalViews, fallback.totalViews)),
    typicalViews: Math.round(nonNegativeNumber(source.typicalViews, fallback.typicalViews)),
    watchHours: Math.round(nonNegativeNumber(source.watchHours, fallback.watchHours) * 10) / 10,
    typicalWatchHours: Math.round(nonNegativeNumber(source.typicalWatchHours, fallback.typicalWatchHours) * 10) / 10,
    subscribersGained: Math.round(nonNegativeNumber(source.subscribersGained, fallback.subscribersGained)),
    revenueTenge: Math.round(nonNegativeNumber(source.revenueTenge, fallback.revenueTenge) * 100) / 100,
    curveShape,
    realtimeViews48h: Math.round(nonNegativeNumber(source.realtimeViews48h, fallback.realtimeViews48h)),
    trafficSources: normalizeTrafficSources(source.trafficSources, fallback.trafficSources),
  }
}

export function normalizePerformanceSections(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {}
  return Object.fromEntries(
    PERFORMANCE_VARIANTS.map((variant) => [variant, normalizePerformanceSection(variant, source[variant])]),
  )
}

export const VIDEO_ANALYTICS_ITEM_PREFIX = 'video-analytics/v/'

export function videoAnalyticsRoute(video) {
  if (video?.id != null && String(video.id) !== '') {
    return `${VIDEO_ANALYTICS_ITEM_PREFIX}${encodeURIComponent(String(video.id))}`
  }
  return video?.type === 'short' ? 'video-analytics/shorts' : 'video-analytics/video'
}

export function videoIdFromAnalyticsRoute(route) {
  const text = String(route || '')
  if (!text.startsWith(VIDEO_ANALYTICS_ITEM_PREFIX)) return null
  try {
    return decodeURIComponent(text.slice(VIDEO_ANALYTICS_ITEM_PREFIX.length)) || null
  } catch {
    return null
  }
}

export function daysSincePublication(publishedAt, now = new Date()) {
  const iso = isoDate(publishedAt)
  if (!iso) return 1
  return Math.max(1, daysBetween(iso, getAlmatyDateISO(now)))
}

/**
 * Ось X в днях с публикации, как в YouTube Studio: всегда 7 отметок,
 * шаг = ceil(дней / 6), последняя отметка = 6 × шаг.
 * 630 → 0/105/…/630, 36 → 0/6/…/36, 534 → 0/89/…/534, 1386 → 0/231/…/1386.
 */
export function buildSincePublicationXAxis(days) {
  const safeDays = Math.max(1, Math.round(Number(days) || 0))
  const intervals = X_TICK_COUNT - 1
  const step = Math.max(1, Math.ceil(safeDays / intervals))
  const ticks = Array.from({ length: X_TICK_COUNT }, (_, index) => index * step)
  return { step, lastTick: step * intervals, ticks }
}

/**
 * Ось Y: 4 отметки 0 / s / 2s / 3s, где s — наименьший «красивый» шаг
 * (1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5 × 10^k), для которого 3s ≥ max.
 * 2,2 млн → 750 тыс.; 370 тыс. → 125 тыс.; 81 млн → 30 млн; 5,9 млн → 2 млн.
 */
export function buildSincePublicationYTicks(maxValue) {
  const safeMax = Math.max(0, Number(maxValue) || 0)
  const intervals = Y_TICK_COUNT - 1
  if (safeMax === 0) return Array.from({ length: Y_TICK_COUNT }, (_, index) => index)
  const rough = safeMax / intervals
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const epsilon = 1e-9
  let step = null
  for (let power = magnitude; step == null; power *= 10) {
    step = Y_NICE_STEPS
      .map((candidate) => candidate * power)
      .find((candidate) => candidate * intervals >= safeMax - epsilon) ?? null
  }
  return Array.from({ length: Y_TICK_COUNT }, (_, index) => cleanNumber(index * step))
}

function cleanNumber(value) {
  return Math.round(value * 1e6) / 1e6
}

const BURST_KNOTS = [
  [0, 0], [0.005, 0.14], [0.02, 0.43], [0.032, 0.5], [0.07, 0.64],
  [0.09, 0.72], [0.14, 0.77], [0.2, 0.87], [0.3, 0.955], [0.45, 0.985], [1, 1],
]

function interpolateKnots(knots, x) {
  for (let index = 1; index < knots.length; index += 1) {
    const [x1, y1] = knots[index]
    if (x <= x1) {
      const [x0, y0] = knots[index - 1]
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
    }
  }
  return 1
}

function shapeFraction(shape, t) {
  const x = Math.max(0, Math.min(1, t))
  switch (shape) {
    case 'gradual': {
      const logistic = (v) => 1 / (1 + Math.exp(-(v - 0.32) / 0.09))
      const base = (logistic(x) - logistic(0)) / (logistic(1) - logistic(0))
      return 0.82 * base + 0.18 * x
    }
    case 'even':
      return 0.86 * x + 0.14 * (1 - Math.exp(-x / 0.3)) / (1 - Math.exp(-1 / 0.3))
    case 'burst':
    default: {
      // Как в YouTube: скачок на старте, излом, ещё одна волна рекомендаций,
      // медленный добор и плато к ~35 % срока. Отрезки прямые — видны изломы.
      return interpolateKnots(BURST_KNOTS, x)
    }
  }
}

/**
 * Нарастающая кривая длиной days + 1: [0] = 0, [days] = total (ровно),
 * монотонная, с небольшим детерминированным «дрожанием» по seed.
 */
export function buildCumulativeCurve({ days, total, shape = 'burst', seed = 1 }) {
  const safeDays = Math.max(1, Math.round(Number(days) || 0))
  const safeTotal = Math.max(0, Math.round(Number(total) || 0))
  const rand = seededRng(Number(seed) || 1)
  const increments = new Array(safeDays)
  let previous = 0
  // Периоды разной активности (рекомендации то включаются, то затихают) и
  // редкие всплески дают на накопленном графике изломы, как в YouTube.
  let regime = 1
  let regimeLeft = 0
  for (let day = 1; day <= safeDays; day += 1) {
    if (regimeLeft <= 0) {
      regime = 0.6 + rand() * 0.8
      regimeLeft = Math.max(2, Math.round(safeDays * (0.008 + rand() * 0.03)))
    }
    regimeLeft -= 1
    const fraction = shapeFraction(shape, day / safeDays)
    const spike = rand() < 0.05 ? 1.6 + rand() * 1.2 : 1
    const launch = day <= Math.max(1, safeDays * 0.02)
    const jitter = launch ? 0.85 + rand() * 0.3 : regime * spike * (0.7 + rand() * 0.6)
    increments[day - 1] = Math.max(0, fraction - previous) * jitter
    previous = fraction
  }
  const weightSum = increments.reduce((sum, value) => sum + value, 0) || 1
  const curve = new Array(safeDays + 1)
  curve[0] = 0
  let running = 0
  for (let day = 1; day <= safeDays; day += 1) {
    running += increments[day - 1]
    curve[day] = Math.round((running / weightSum) * safeTotal)
    if (curve[day] < curve[day - 1]) curve[day] = curve[day - 1]
  }
  curve[safeDays] = safeTotal
  return curve
}

/** 48 часовых столбиков с двумя «дневными» волнами; сумма ровно total. */
export function buildRealtimeBars(total, seed = 1) {
  const safeTotal = Math.max(0, Math.round(Number(total) || 0))
  const rand = seededRng(Number(seed) || 1)
  const weights = Array.from({ length: REALTIME_HOURS }, (_, hour) => {
    const wave = 0.62 + 0.38 * Math.cos(((hour - 12) / 24) * Math.PI * 2)
    return Math.max(0.05, wave * (0.9 + rand() * 0.2))
  })
  const sum = weights.reduce((acc, value) => acc + value, 0)
  const bars = weights.map((value) => Math.floor((value / sum) * safeTotal))
  let rest = safeTotal - bars.reduce((acc, value) => acc + value, 0)
  for (let index = bars.length - 1; rest > 0; index = (index - 1 + bars.length) % bars.length) {
    bars[index] += 1
    rest -= 1
  }
  return bars
}

/** Мини-гистограмма источника трафика: 8 столбиков, высота пропорциональна доле. */
export function buildSourceSparkline(percent, seed = 1) {
  const rand = seededRng(Number(seed) || 1)
  const level = Math.max(0, Math.min(100, Number(percent) || 0)) / 50
  return Array.from({ length: 8 }, () => Math.min(1, level * (0.55 + rand() * 0.45)))
}

export const SINCE_PUBLICATION_METRICS = ['views', 'watch', 'subscribers', 'revenue']

function scaledTypicalTotal(ownTotal, section) {
  if (section.totalViews <= 0) return 0
  return ownTotal * (section.typicalViews / section.totalViews)
}

function generatedMetricCurves(section, days, seedBase) {
  const curve = (total, shape, salt, scale = 1) => buildCumulativeCurve({
    days,
    total: Math.round(total * scale),
    shape,
    seed: hashSeed(seedBase, salt, Math.round(total * scale)),
  }).map((value) => value / scale)
  return {
    views: {
      own: curve(section.totalViews, section.curveShape, 'views'),
      typical: curve(section.typicalViews, 'gradual', 'typical'),
    },
    watch: {
      own: curve(section.watchHours, section.curveShape, 'watch', 10),
      typical: curve(section.typicalWatchHours, 'gradual', 'watch-typical', 10),
    },
    subscribers: {
      own: curve(section.subscribersGained, section.curveShape, 'subscribers'),
      typical: curve(scaledTypicalTotal(section.subscribersGained, section), 'gradual', 'subscribers-typical'),
    },
    revenue: {
      own: curve(section.revenueTenge, section.curveShape, 'revenue', 100),
      typical: curve(scaledTypicalTotal(section.revenueTenge, section), 'gradual', 'revenue-typical', 100),
    },
  }
}

function lastValue(line) {
  for (let index = line.length - 1; index >= 0; index -= 1) if (line[index] != null) return line[index]
  return 0
}

export function buildPerformanceSectionView(sectionInput, now = new Date(), curves = {}) {
  const section = normalizePerformanceSection(sectionInput?.variant, sectionInput)
  const metrics = curves.metrics
  const days = metrics
    ? Math.max(1, metrics.views.own.length - 1)
    : daysSincePublication(section.publishedAt, now)
  const xAxis = buildSincePublicationXAxis(days)
  const seedBase = hashSeed('since-publication', section.variant, section.publishedAt, section.curveShape)
  const series = metrics || generatedMetricCurves(section, days, seedBase)

  const chartData = []
  for (let day = 0; day <= xAxis.lastTick; day += 1) {
    // Точка day — итог за первые day суток: последний учтённый день — publishedAt + day − 1.
    const row = { day, date: isoDay(addDays(section.publishedAt, Math.max(0, day - 1))) }
    for (const key of SINCE_PUBLICATION_METRICS) {
      row[key] = day <= days ? (series[key].own[day] ?? null) : null
      row[`${key}Typical`] = day <= days ? (series[key].typical[day] ?? null) : null
    }
    chartData.push(row)
  }
  const yTicksByMetric = Object.fromEntries(SINCE_PUBLICATION_METRICS.map((key) => {
    const max = Math.max(
      ...series[key].own.filter((value) => value != null),
      ...series[key].typical.filter((value) => value != null),
      0,
    )
    return [key, buildSincePublicationYTicks(max)]
  }))
  const yTicks = yTicksByMetric.views
  return {
    variant: section.variant,
    section,
    days,
    xAxis,
    yTicks,
    yDomain: [0, yTicks[yTicks.length - 1]],
    yTicksByMetric,
    chartData,
    realtime: {
      total: section.realtimeViews48h,
      bars: curves.realtimeBars || buildRealtimeBars(section.realtimeViews48h, hashSeed(seedBase, 'realtime', section.realtimeViews48h)),
      sources: section.trafficSources.map((item, index) => ({
        ...item,
        spark: buildSourceSparkline(item.percent, hashSeed(seedBase, 'source', index, item.label)),
      })),
    },
    kpis: {
      views: section.totalViews,
      typicalViews: metrics ? (series.views.typical[days] ?? null) : section.typicalViews,
      watchHours: section.watchHours,
      typicalWatchHours: metrics ? (series.watch.typical[days] ?? null) : section.typicalWatchHours,
      subscribers: section.subscribersGained,
      typicalSubscribers: metrics ? (series.subscribers.typical[days] ?? null) : lastValue(series.subscribers.typical),
      revenueTenge: section.revenueTenge,
      typicalRevenueTenge: metrics ? (series.revenue.typical[days] ?? null) : lastValue(series.revenue.typical),
    },
  }
}

/**
 * Аналитика «С момента публикации» конкретного видео. Все числа берутся из
 * движка аналитики канала (buildVideoLifetimeAnalytics), поэтому совпадают
 * с остальными экранами студии.
 */
export function buildVideoPerformanceView(video, videos = [], channel = {}, now = new Date()) {
  const analytics = buildVideoLifetimeAnalytics(video, videos, channel, { today: now })
  if (analytics.days < 1) {
    // Первые сутки ещё не закончились — в YouTube статистика ещё обрабатывается.
    const empty = buildPerformanceSectionView({
      variant: video?.type === 'short' ? 'shorts' : 'video',
      publishedAt: analytics.publishedAt,
      totalViews: 0,
      typicalViews: 0,
      watchHours: 0,
      typicalWatchHours: 0,
      subscribersGained: 0,
      revenueTenge: 0,
      realtimeViews48h: analytics.realtime.total,
      trafficSources: [],
    }, now)
    return { ...empty, pending: true }
  }
  const toTenge = (line) => line.map((value) => (value == null ? null : Math.round(value * TENGE_PER_DOLLAR * 100) / 100))
  return buildPerformanceSectionView({
    variant: video?.type === 'short' ? 'shorts' : 'video',
    publishedAt: analytics.publishedAt,
    totalViews: analytics.kpis.views,
    typicalViews: analytics.kpis.typicalViews ?? 0,
    watchHours: analytics.kpis.watchHours,
    typicalWatchHours: analytics.kpis.typicalWatchHours ?? 0,
    subscribersGained: analytics.kpis.subscribers,
    revenueTenge: analytics.kpis.revenue * TENGE_PER_DOLLAR,
    realtimeViews48h: analytics.realtime.total,
    trafficSources: analytics.traffic.slice(0, MAX_TRAFFIC_SOURCES).map((item) => ({
      label: item.label,
      percent: Math.round(item.share * 1000) / 10,
    })),
  }, now, {
    metrics: {
      views: { own: analytics.curves.views, typical: analytics.typical.views },
      watch: { own: analytics.curves.watch, typical: analytics.typical.watch },
      subscribers: { own: analytics.curves.subscribers, typical: analytics.typical.subscribers },
      revenue: { own: toTenge(analytics.curves.revenue), typical: toTenge(analytics.typical.revenue) },
    },
    realtimeBars: analytics.realtime.bars,
  })
}
