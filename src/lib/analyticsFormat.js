/**
 * Локальные форматтеры для аналитики. Используют ru-RU.
 */

import { toCalendarDate } from './analyticsEngine.js'

const NBSP = '\u00a0'

export function formatCompactNumber(n) {
  const v = Number(n) || 0
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.', ',')}${NBSP}млн`
  if (v >= 10_000) return `${(v / 1_000).toFixed(0)}${NBSP}тыс.`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace('.', ',')}${NBSP}тыс.`
  return Math.round(v).toLocaleString('ru-RU')
}

function truncateCompact(value, divisor) {
  const truncated = Math.trunc((value / divisor) * 10) / 10
  return truncated.toLocaleString('ru-RU', {
    minimumFractionDigits: Number.isInteger(truncated) ? 0 : 1,
    maximumFractionDigits: 1,
  })
}

export function formatSignedCompactNumber(n) {
  const value = Number(n) || 0
  const magnitude = Math.abs(value)
  if (magnitude === 0) return '0'

  const sign = value > 0 ? '+' : '-'
  if (magnitude >= 1_000_000) {
    return `${sign}${truncateCompact(magnitude, 1_000_000)}${NBSP}млн`
  }
  if (magnitude >= 1_000) {
    return `${sign}${truncateCompact(magnitude, 1_000)}${NBSP}тыс.`
  }
  const compactValue = Number.isInteger(magnitude)
    ? magnitude.toLocaleString('ru-RU')
    : magnitude.toLocaleString('ru-RU', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })
  return `${sign}${compactValue}`
}

/** «81,0 млн», «5,9 млн», «254,1 тыс.» — всегда один знак после запятой от 1000. */
export function formatCompactOneDecimal(n) {
  const value = Math.abs(Number(n) || 0)
  const oneDecimal = (v) => (Math.trunc(v * 10) / 10).toLocaleString('ru-RU', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  if (value >= 1_000_000) return `${oneDecimal(value / 1_000_000)}${NBSP}млн`
  if (value >= 1_000) return `${oneDecimal(value / 1_000)}${NBSP}тыс.`
  return Math.round(value).toLocaleString('ru-RU')
}

/** Подписи оси: «0», «750 тыс.», «1,5 млн», «2,3 млн», «6 млн» (без «,0»). */
export function formatAxisCompact(n) {
  const value = Math.max(0, Number(n) || 0)
  const short = (v) => (Math.round(v * 10) / 10).toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })
  if (value >= 1_000_000) return `${short(value / 1_000_000)}${NBSP}млн`
  if (value >= 1_000) return `${short(value / 1_000)}${NBSP}тыс.`
  return Math.round(value).toLocaleString('ru-RU')
}

/** «раз» / «раза»: 1 раз, 2 раза, 5 раз, 5 942 494 раза, 81 022 050 раз. */
export function declineTimes(n) {
  const value = Math.abs(Math.round(Number(n) || 0))
  const lastTwo = value % 100
  const last = value % 10
  if (lastTwo >= 11 && lastTwo <= 14) return 'раз'
  if (last >= 2 && last <= 4) return 'раза'
  return 'раз'
}

/** «1386 дней», «21 день», «3 дня». */
export function declineDaysLabel(n) {
  const value = Math.abs(Math.round(Number(n) || 0))
  const lastTwo = value % 100
  const last = value % 10
  let word = 'дней'
  if (!(lastTwo >= 11 && lastTwo <= 14)) {
    if (last === 1) word = 'день'
    else if (last >= 2 && last <= 4) word = 'дня'
  }
  return `${value} ${word}`
}

export function formatHours(hours) {
  const v = Number(hours) || 0
  if (v >= 1000) return v.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  if (v >= 10) return v.toFixed(1).replace('.', ',')
  return v.toFixed(2).replace('.', ',')
}

export function formatSecondsAsClock(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

export function formatPercent(pct, digits = 1) {
  const v = Number(pct) || 0
  return v.toFixed(digits).replace('.', ',') + '%'
}

export function formatMoneyShort(amount) {
  const v = Number(amount) || 0
  const NBSP = ' '
  const fmt = (s) => s.replace(/ /g, NBSP)
  if (v >= 100_000) return fmt(`${Math.round(v).toLocaleString('ru-RU')} $`)
  if (v >= 1_000) return fmt(`${v.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)} $`)
  return `${v.toFixed(2).replace('.', ',')}${NBSP}$`
}

export function formatMoneyFixed(amount) {
  const v = Number(amount) || 0
  const NBSP = '\u00a0'
  return `${v.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}${NBSP}$`
}

export function formatNumberRu(n) {
  return Math.round(Number(n) || 0).toLocaleString('ru-RU')
}

export function formatDateLong(iso) {
  if (!iso) return ''
  const d = toCalendarDate(iso)
  const m = ['янв.','февр.','мар.','апр.','мая','июн.','июл.','авг.','сент.','окт.','нояб.','дек.'][d.getMonth()]
  return `${d.getDate()} ${m} ${d.getFullYear()} г.`
}
