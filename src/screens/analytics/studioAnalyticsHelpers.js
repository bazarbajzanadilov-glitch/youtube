import {
  formatCompactNumber,
  formatDateLong,
  formatNumberRu,
  formatPercent,
  formatSecondsAsClock,
} from '../../lib/analyticsFormat.js'

export const ANALYTICS_BLUE = '#41b4d9'
export const ANALYTICS_PURPLE = '#41b4d9'
export const ANALYTICS_TEAL = '#41b4d9'
export const ANALYTICS_MUTED = '#aaa'

const NBSP = '\u00a0'

export function formatTenge(amount) {
  const value = (Number(amount) || 0) * 512
  return `${value.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}${NBSP}₸`
}

export function formatTengeShort(amount) {
  const value = (Number(amount) || 0) * 512
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')}${NBSP}млн${NBSP}₸`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace('.', ',')}${NBSP}тыс.${NBSP}₸`
  return `${value.toFixed(0)}${NBSP}₸`
}

export function formatTengeAxis(amount) {
  const value = (Number(amount) || 0) * 512
  const hasFraction = Math.abs(value - Math.round(value)) > 0.005
  return `${value.toLocaleString('ru-RU', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  })}${NBSP}₸`
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
  return formatSecondsAsClock(Math.round(durationToSec(video?.duration) * 0.45))
}

export function avgWatchPercent(video) {
  const seconds = Math.max(1, durationToSec(video?.duration))
  return formatPercent((Math.round(seconds * 0.45) / seconds) * 100, 1)
}

export function ctrPretty(video) {
  const seed = (Number(video?.views) || 0) % 100
  return formatPercent(8 + (seed % 8), 1)
}

export function daysSinceLong(iso) {
  if (!iso) return ''
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000))
  if (days === 0) return 'Опубликовано сегодня'
  const lastTwo = days % 100
  const last = days % 10
  if (lastTwo >= 11 && lastTwo <= 14) return `${days} дней после публикации`
  if (last === 1) return `${days} день после публикации`
  if (last >= 2 && last <= 4) return `${days} дня после публикации`
  return `${days} дней после публикации`
}

function pluralizeRu(value, one, twoFour, many) {
  const abs = Math.abs(value)
  const lastTwo = abs % 100
  const last = abs % 10
  if (lastTwo >= 11 && lastTwo <= 14) return many
  if (last === 1) return one
  if (last >= 2 && last <= 4) return twoFour
  return many
}

export function liveEndedLong(iso) {
  if (!iso) return ''
  const diffMs = Math.max(0, Date.now() - new Date(iso).getTime())
  const totalHours = Math.floor(diffMs / 3600000)
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  const parts = []
  if (days > 0) {
    parts.push(`${days} ${pluralizeRu(days, 'день', 'дня', 'дней')}`)
  }
  if (hours > 0 || parts.length === 0) {
    parts.push(`${hours} ${pluralizeRu(hours, 'час', 'часа', 'часов')}`)
  }
  return `Во время прямого эфира (он закончился ${parts.join(' ')} назад)`
}

export function belowUsual(value, format = formatCompactNumber, prefix = 'Значение ниже обычного') {
  const safe = Math.max(1, Number(value) || 1)
  const diff = safe * 6.8
  return `${prefix} (на ${format(diff)})`
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
