import {
  formatCompactNumber,
  formatDateLong,
  formatNumberRu,
  formatPercent,
  formatSecondsAsClock,
} from '../../lib/analyticsFormat.js'
import { addDays, daysBetween, isoDay, toCalendarDate } from '../../lib/analyticsEngine.js'
import { getAlmatyDateISO } from '../../lib/almatyDate.js'
import { averageViewFraction } from '../../lib/videoMetrics.js'

export const ANALYTICS_BLUE = '#41b4d9'
export const ANALYTICS_PURPLE = '#bc69f3'
export const ANALYTICS_TEAL = '#39cfc2'
export const ANALYTICS_MUTED = 'var(--studio-text-muted)'

const NBSP = '\u00a0'

function tengeValue(amount) {
  return (Number(amount) || 0) * 512
}

function formatTengeFull(amount, currencyGap = NBSP) {
  const value = tengeValue(amount)
  return `${value.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}${currencyGap}₸`
}

export function formatTenge(amount) {
  return formatTengeFull(amount)
}

export function formatTengeChart(amount) {
  return formatTengeFull(amount)
}

export function formatTengeShort(amount) {
  return formatTengeChart(amount)
}

export function formatTengeAxis(amount) {
  return formatTengeChart(amount)
}

export function rangePrefix(range) {
  if (range?.kind === '7d') return 'За последние 7 дней'
  if (range?.kind === '90d') return 'За последние 90 дней'
  if (range?.kind === '365d') return 'За последние 365 дней'
  if (range?.kind === 'lifetime') return 'За все время'
  if (range?.kind === 'custom') return 'За выбранный период'
  return 'За последние 28 дней'
}

export function declineViews(n) {
  const value = Math.abs(Math.round(Number(n) || 0))
  const lastTwo = value % 100
  const last = value % 10
  if (lastTwo >= 11 && lastTwo <= 14) return 'просмотров'
  if (last === 1) return 'просмотр'
  if (last >= 2 && last <= 4) return 'просмотра'
  return 'просмотров'
}

export function durationToSec(duration) {
  if (!duration) return 0
  const parts = String(duration).split(':').map((part) => parseInt(part, 10) || 0)
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return parseInt(duration, 10) || 0
}

export function avgWatchPretty(video) {
  const fraction = averageViewFraction(video)
  if (fraction == null) return '—'
  return formatSecondsAsClock(Math.round(durationToSec(video?.duration) * fraction))
}

export function avgWatchPercent(video) {
  const fraction = averageViewFraction(video)
  if (fraction == null) return '—'
  return formatPercent(fraction * 100, 1)
}

export function ctrPretty(video) {
  const seed = (Number(video?.views) || 0) % 100
  return formatPercent(8 + (seed % 8), 1)
}

export function daysSinceLong(iso, now = new Date()) {
  if (!iso) return ''
  const days = Math.max(0, daysBetween(iso, getAlmatyDateISO(now)))
  if (days === 0) return 'Опубликовано сегодня'
  const lastTwo = days % 100
  const last = days % 10
  if (lastTwo >= 11 && lastTwo <= 14) return `${days} дней после публикации`
  if (last === 1) return `${days} день после публикации`
  if (last >= 2 && last <= 4) return `${days} дня после публикации`
  return `${days} дней после публикации`
}

export function belowUsual(value, format = formatCompactNumber, prefix = 'Значение ниже обычного') {
  const safe = Math.max(1, Number(value) || 1)
  const diff = safe * 6.8
  return `${prefix} (на ${format(diff)})`
}

export function kpiTrend(delta) {
  const value = Number(delta) || 0
  if (value > 0.1) return 'up'
  if (value < -0.1) return 'down'
  return 'neutral'
}

function diffFromDelta(value, delta) {
  const current = Number(value) || 0
  const change = Number(delta) || 0
  if (Math.abs(change) <= 0.1) return 0
  const denominator = 1 + (change / 100)
  if (Math.abs(denominator) < 0.001) return Math.abs(current)
  const previous = current / denominator
  return Math.abs(current - previous)
}

export function usualComparison(kpi, format = formatCompactNumber) {
  if (kpi?.delta == null) return '—'
  const delta = Number(kpi?.delta) || 0
  if (Math.abs(delta) <= 0.1) return 'Обычное значение'
  const diff = diffFromDelta(kpi?.value, delta) || Math.abs(Number(kpi?.value) || 0)
  return `На ${format(diff)} ${delta > 0 ? 'больше' : 'меньше'}, чем обычно`
}

export function absoluteUsualComparison(value, format = formatCompactNumber) {
  const amount = Math.abs(Number(value) || 0)
  if (amount <= 0) return 'Обычное значение'
  return `На ${format(amount)} ${Number(value) >= 0 ? 'больше' : 'меньше'}, чем обычно`
}

export function buildPublishedVideoMarkers(
  series = [],
  videos = [],
  xKey = 'date',
  rangeBounds = null,
) {
  const seriesDates = (series || [])
    .map((row) => String(row?.[xKey] || '').slice(0, 10))
    .filter(Boolean)
    .sort()
  if (seriesDates.length === 0) return []
  const lastSeriesDate = seriesDates[seriesDates.length - 1]
  const previousSeriesDate = seriesDates[seriesDates.length - 2]
  const bucketGap = previousSeriesDate
    ? daysBetween(previousSeriesDate, lastSeriesDate)
    : 1
  const lastBucketStart = toCalendarDate(lastSeriesDate)
  const lastBucketEnd = bucketGap >= 27 && lastBucketStart.getDate() === 1
    ? new Date(lastBucketStart.getFullYear(), lastBucketStart.getMonth() + 1, 0)
    : bucketGap >= 6
      ? addDays(lastBucketStart, 6)
      : lastBucketStart
  const requestedStart = rangeBounds?.from ? isoDay(toCalendarDate(rangeBounds.from)) : ''
  const requestedEnd = rangeBounds?.to ? isoDay(toCalendarDate(rangeBounds.to)) : ''
  const inferredEnd = isoDay(lastBucketEnd)
  const lastAcceptedDate = requestedEnd && requestedEnd < inferredEnd ? requestedEnd : inferredEnd
  const firstAcceptedDate = requestedStart && requestedStart > seriesDates[0]
    ? requestedStart
    : seriesDates[0]

  const grouped = new Map()
  ;(videos || []).forEach((video) => {
    const date = String(video?.date || video?.publishedAt || '').slice(0, 10)
    if (!date || date < firstAcceptedDate || date > lastAcceptedDate) return
    let bucketDate = ''
    for (const seriesDate of seriesDates) {
      if (seriesDate > date) break
      bucketDate = seriesDate
    }
    if (!bucketDate) return
    if (!grouped.has(bucketDate)) grouped.set(bucketDate, [])
    grouped.get(bucketDate).push(video)
  })

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, markerVideos]) => ({
      date,
      count: markerVideos.length,
      label: `${markerVideos.length} ${markerVideos.length === 1 ? 'опубликованное видео' : 'опубликованных видео'}`,
      videos: markerVideos
        .slice()
        .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'ru'))
        .map((video) => ({
          id: video.id,
          title: video.title || 'Без названия',
          cover: video.cover || '',
          date,
          duration: video.duration || '',
          views: video.views || 0,
        })),
    }))
}

export function comparePreviousText() {
  return 'На 99 % меньше, чем за предыдущие 28 дней'
}

export function signedNumber(value) {
  const n = Math.round(Number(value) || 0)
  return `${n >= 0 ? '+' : ''}${formatNumberRu(n)}`
}

export function videoDate(video) {
  return formatDateLong(video?.date)
}
