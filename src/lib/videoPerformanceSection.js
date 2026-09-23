/**
 * Раздел «С момента публикации» — статистика одного видео (Shorts / обычное),
 * как на странице аналитики видео в YouTube Studio.
 *
 * Данные раздела вводятся в админке и не зависят от диапазона аналитики канала.
 * Кривая графика генерируется детерминированно из введённых чисел.
 */

import { addDays, daysBetween, hashSeed, isoDay, seededRng } from './analyticsEngine.js'
import { getAlmatyDateISO } from './almatyDate.js'

export const PERFORMANCE_VARIANTS = ['shorts', 'video']

export const CURVE_SHAPES = [
  { value: 'burst', label: 'Резкий старт и плато' },
  { value: 'gradual', label: 'Плавный рост' },
  { value: 'even', label: 'Равномерный рост' },
]

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
  }
}

export function normalizePerformanceSections(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {}
  return Object.fromEntries(
    PERFORMANCE_VARIANTS.map((variant) => [variant, normalizePerformanceSection(variant, source[variant])]),
  )
}

export function videoAnalyticsRoute(video) {
  return video?.type === 'short' ? 'video-analytics/shorts' : 'video-analytics/video'
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
      const fast = (1 - Math.exp(-x / 0.02)) / (1 - Math.exp(-1 / 0.02))
      const slow = (1 - Math.exp(-x / 0.28)) / (1 - Math.exp(-1 / 0.28))
      return 0.62 * fast + 0.22 * slow + 0.16 * x
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
  for (let day = 1; day <= safeDays; day += 1) {
    const fraction = shapeFraction(shape, day / safeDays)
    const jitter = 0.78 + rand() * 0.44
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

export function buildPerformanceSectionView(sectionInput, now = new Date()) {
  const section = normalizePerformanceSection(sectionInput?.variant, sectionInput)
  const days = daysSincePublication(section.publishedAt, now)
  const xAxis = buildSincePublicationXAxis(days)
  const seedBase = hashSeed('since-publication', section.variant, section.publishedAt, section.curveShape)
  const views = buildCumulativeCurve({
    days,
    total: section.totalViews,
    shape: section.curveShape,
    seed: hashSeed(seedBase, section.totalViews),
  })
  const typical = buildCumulativeCurve({
    days,
    total: section.typicalViews,
    shape: 'gradual',
    seed: hashSeed(seedBase, 'typical', section.typicalViews),
  })
  const chartData = []
  for (let day = 0; day <= xAxis.lastTick; day += 1) {
    const isReal = day <= days
    chartData.push({
      day,
      date: isoDay(addDays(section.publishedAt, day)),
      views: isReal ? views[day] : null,
      typical: isReal ? typical[day] : null,
    })
  }
  const yTicks = buildSincePublicationYTicks(Math.max(section.totalViews, section.typicalViews))
  return {
    variant: section.variant,
    section,
    days,
    xAxis,
    yTicks,
    yDomain: [0, yTicks[yTicks.length - 1]],
    chartData,
    kpis: {
      views: section.totalViews,
      typicalViews: section.typicalViews,
      watchHours: section.watchHours,
      typicalWatchHours: section.typicalWatchHours,
      subscribers: section.subscribersGained,
      revenueTenge: section.revenueTenge,
    },
  }
}
