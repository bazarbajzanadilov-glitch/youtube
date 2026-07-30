import {
  formatCompactNumber,
  formatDateLong,
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
const USUAL_DELTA_THRESHOLD = 10

export const KPI_DESCRIPTIONS = {
  views: 'Количество просмотров всех ваших видео, включая удаленные, за текущий период по сравнению с вашими обычными показателями. Если проанализировать сведения за долгое время, можно выявить наиболее эффективные видео, предсказать сезонные изменения, а также определить, когда лучше всего загружать ролики.',
  watchTime: 'Время просмотра всех видео (включая ролики с ограниченным доступом и доступом по ссылке) на канале за текущий период по сравнению с обычными показателями. Учитываются в том числе и удаленные ролики.',
  engagedViews: 'Сколько раз зрители продолжали смотреть видео дольше нескольких секунд.',
  likes: 'Изменение общего количества оценок «Нравится» (поставленные минус снятые) в этом регионе за выбранный период. До 1 сентября 2012 года количество снятых оценок не вычиталось.',
  subscribers: 'Изменение числа подписчиков за текущий период в сравнении с предыдущим. По данным за продолжительный отрезок времени можно понять, почему пользователи подписываются на ваш канал или отменяют подписку.',
  revenue: 'Расчетный доход от всех источников за выбранный период. Итоговая сумма может измениться после окончательной обработки данных.',
  monthlyViewers: 'Предполагаемое общее количество зрителей за последние 28 дней. Этот показатель рассчитывается ежедневно и всегда за предыдущие 28 дней с определенного дня.',
  impressions: 'Количество показов значков ваших видео зрителям на YouTube за выбранный период.',
  ctr: 'Доля показов значков видео, после которых зрители начали смотреть видео.',
  averageViewDuration: 'Средняя продолжительность просмотра одного видео за выбранный период.',
}

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
  if (kpi?.delta == null || !Number.isFinite(Number(kpi.delta))) return ''
  const delta = Number(kpi.delta)
  if (Math.abs(delta) <= USUAL_DELTA_THRESHOLD) return 'Обычное значение'
  const diff = diffFromDelta(kpi?.value, delta) || Math.abs(Number(kpi?.value) || 0)
  return `Значение ${delta > 0 ? 'выше' : 'ниже'} обычного (на ${format(diff)})`
}

export function absoluteUsualComparison(value, format = formatCompactNumber) {
  const amount = Math.abs(Number(value) || 0)
  if (amount <= 0) return 'Обычное значение'
  return `На ${format(amount)} ${Number(value) >= 0 ? 'больше' : 'меньше'}, чем обычно`
}

function declineDays(value) {
  const days = Math.abs(Math.round(Number(value) || 0))
  const lastTwo = days % 100
  const last = days % 10
  if (lastTwo >= 11 && lastTwo <= 14) return 'дней'
  if (last === 1) return 'день'
  if (last >= 2 && last <= 4) return 'дня'
  return 'дней'
}

function previousPeriodLabel(range) {
  const days = Math.max(1, Math.round(Number(range?.days) || 28))
  return `за предыдущие ${days.toLocaleString('ru-RU')} ${declineDays(days)}`
}

export function previousPeriodComparison(kpi, range) {
  if (range?.kind === 'lifetime') return ''
  if (kpi?.delta == null || !Number.isFinite(Number(kpi.delta))) return ''
  const delta = Number(kpi.delta)
  const label = previousPeriodLabel(range)
  if (Math.abs(delta) < 0.5) return `Как ${label}`
  const percent = Math.max(1, Math.round(Math.abs(delta)))
  return `На ${percent.toLocaleString('ru-RU')} % ${delta > 0 ? 'больше' : 'меньше'}, чем ${label}`
}

export function metricPerformanceComparison(kpi, range, format = formatCompactNumber) {
  if (range?.kind === 'lifetime') return ''
  if (kpi?.delta == null || !Number.isFinite(Number(kpi.delta))) return ''

  const delta = Number(kpi.delta)
  if (delta > 0.1) return previousPeriodComparison(kpi, range)
  if (delta < -0.1) {
    const previousValue = Number(kpi?.previousValue)
    const diff = Number.isFinite(previousValue)
      ? Math.abs((Number(kpi?.value) || 0) - previousValue)
      : diffFromDelta(kpi?.value, delta)
    return `Значение ниже обычного (на ${format(diff)})`
  }
  return 'Обычное значение'
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

export function videoDate(video) {
  return formatDateLong(video?.date)
}
