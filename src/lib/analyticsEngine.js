/**
 * Чистые детерминированные генераторы аналитических серий.
 * Никакого React/localStorage. Все вызовы стабильны при одинаковых сидах.
 *
 * Сид-схема: `hashSeed(channelId, video.id, range.kind, profile)` → число.
 * Это значит: при правке totals/добавлении видео — серии меняются,
 * но при reload без изменений — стабильны.
 */

/* === seeded RNG (mulberry32) === */
export function seededRng(seedNum) {
  let t = (Math.floor(seedNum) | 0) || 0x9e3779b9
  return () => {
    t = (t + 0x6d2b79f5) | 0
    let r = Math.imul(t ^ (t >>> 15), t | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function hashSeed(...parts) {
  let h = 2166136261
  const str = parts.join('|')
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) || 1
}

/* === date helpers === */
export const DAY_MS = 86400000

export function isoDay(d) {
  const dt = d instanceof Date ? d : new Date(d)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export function addDays(d, n) {
  const dt = d instanceof Date ? new Date(d.getTime()) : new Date(d)
  dt.setDate(dt.getDate() + n)
  return dt
}
export function daysBetween(a, b) {
  const ax = a instanceof Date ? a : new Date(a)
  const bx = b instanceof Date ? b : new Date(b)
  return Math.round((bx.getTime() - ax.getTime()) / DAY_MS)
}
export function startOfDay(d) {
  const dt = d instanceof Date ? new Date(d.getTime()) : new Date(d)
  dt.setHours(0, 0, 0, 0)
  return dt
}

/* === profiles === */

export function inferProfile(video, today = new Date()) {
  const ageDays = Math.max(0, daysBetween(new Date(video.date), today))
  const v = Number(video.views) || 0
  if (v > 200000 && ageDays < 30) return 'viralSpike'
  if (ageDays > 180) return 'decayAfterPeak'
  if (v < 5000) return 'steady'
  return 'gradualGrowth'
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function profileParams(profile, rand) {
  switch (profile) {
    case 'viralSpike':
      return {
        peakAt: 1.8 + rand() * 3.4,
        rampPower: 1.75 + rand() * 0.45,
        decay: 0.045 + rand() * 0.025,
        floor: 0.045 + rand() * 0.035,
        plateau: 1 + Math.floor(rand() * 2),
        spikeChance: 0.065,
      }
    case 'decayAfterPeak':
      return {
        peakAt: 3.5 + rand() * 7,
        rampPower: 1.55 + rand() * 0.35,
        decay: 0.018 + rand() * 0.014,
        floor: 0.075 + rand() * 0.055,
        plateau: 2 + Math.floor(rand() * 4),
        spikeChance: 0.035,
      }
    case 'steady':
      return {
        peakAt: 5 + rand() * 12,
        rampPower: 1.25 + rand() * 0.3,
        decay: 0.006 + rand() * 0.006,
        floor: 0.18 + rand() * 0.12,
        plateau: 5 + Math.floor(rand() * 8),
        spikeChance: 0.045,
      }
    case 'seasonal':
      return {
        peakAt: 6 + rand() * 18,
        rampPower: 1.35 + rand() * 0.35,
        decay: 0.008 + rand() * 0.012,
        floor: 0.13 + rand() * 0.09,
        plateau: 4 + Math.floor(rand() * 10),
        spikeChance: 0.06,
      }
    case 'gradualGrowth':
    default:
      return {
        peakAt: 7 + rand() * 18,
        rampPower: 1.35 + rand() * 0.4,
        decay: 0.011 + rand() * 0.014,
        floor: 0.1 + rand() * 0.08,
        plateau: 3 + Math.floor(rand() * 7),
        spikeChance: 0.05,
      }
  }
}

export function getVideoAgeDays(date, today = new Date()) {
  if (!date) return 0
  const publish = startOfDay(new Date(date))
  const todayD = startOfDay(today)
  if (Number.isNaN(publish.getTime()) || publish > todayD) return 0
  return Math.max(0, daysBetween(publish, todayD))
}

export function generateLifecycleShape({ seed, days, profile = 'gradualGrowth', startWeekday = 0 }) {
  if (days <= 0) return []
  const rand = seededRng(seed)
  const params = profileParams(profile, rand)
  const out = new Array(days).fill(0)
  const peakIdx = clamp(Math.round(params.peakAt), 0, days - 1)
  let drift = 1

  for (let i = 0; i < days; i += 1) {
    const weekend = ((startWeekday + i) % 7 >= 5) ? 1.1 : 1
    const wave = 1 + Math.sin((i + startWeekday) / 7 * Math.PI * 2) * 0.055
    let phase

    if (i <= peakIdx) {
      const t = peakIdx === 0 ? 1 : i / peakIdx
      phase = 0.035 + Math.pow(t, params.rampPower)
    } else if (i <= peakIdx + params.plateau) {
      const t = (i - peakIdx) / Math.max(1, params.plateau)
      phase = 1 - t * (0.08 + rand() * 0.05)
    } else {
      const t = i - peakIdx - params.plateau
      phase = params.floor + (1 - params.floor) * Math.exp(-t * params.decay)
    }

    drift = clamp(drift + (rand() - 0.5) * 0.08, 0.78, 1.22)
    let value = phase * weekend * wave * drift * (0.88 + rand() * 0.24)
    if (rand() < params.spikeChance) value *= 1.18 + rand() * 0.28
    if (rand() < 0.035) value *= 0.74 + rand() * 0.12
    out[i] = Math.max(0.015, value)
  }

  if (days > 1) out[0] = Math.min(out[0], out[peakIdx] * (0.03 + rand() * 0.04))
  if (days > 2) out[1] = Math.min(out[1], out[peakIdx] * (0.1 + rand() * 0.08))
  return out
}

export function estimateLifetimeViews({ seed, ageDays, profile = 'gradualGrowth' }) {
  const rand = seededRng(seed)
  const safeAge = Math.max(0, Number(ageDays) || 0)
  const ageFactor = Math.pow(safeAge + 1, 0.78)
  const maturity = 1 - Math.exp(-safeAge / 42)
  const profileBase = {
    viralSpike: 9000,
    decayAfterPeak: 3600,
    seasonal: 2500,
    steady: 700,
    gradualGrowth: 1700,
  }[profile] || 1700
  const volatility = 0.55 + rand() * 1.35
  const evergreenBoost = safeAge > 120 ? 1 + rand() * 0.45 : 1
  const currentDayCap = safeAge === 0 ? 0.035 + rand() * 0.08 : 1
  const views = profileBase * ageFactor * (0.2 + maturity) * volatility * evergreenBoost * currentDayCap
  return Math.max(safeAge === 0 ? 8 : 60, Math.round(views))
}

export function estimateLifetimeRevenue({ views, seed, ageDays }) {
  const safeViews = Math.max(0, Number(views) || 0)
  if (safeViews <= 0) return 0
  const rand = seededRng(seed)
  const safeAge = Math.max(0, Number(ageDays) || 0)
  const monetizedRamp = safeAge === 0 ? 0.72 + rand() * 0.18 : 0.9 + rand() * 0.16
  const ratePerThousand = 8 + rand() * 14
  const revenue = safeViews * monetizedRamp * ratePerThousand / 1000
  return Math.round(revenue * 100) / 100
}

/**
 * Генерирует сырую (ненормированную) дневную форму длиной `days` для профиля.
 * Веса сб/вс ×1.15. Внутри — drift-режимы (4–10-дневные блоки), редкие пики/просадки.
 * Все профили имеют long-tail floor — даже старые видео сохраняют видимую активность
 * в недавних днях (важно для аналитики: 28d-окно по 365-дневному видео не должно быть пустым).
 * Возвращает массив положительных чисел.
 */
export function generateDailyShape({ seed, days, profile = 'gradualGrowth', startWeekday = 0 }) {
  if (days <= 0) return []
  const rand = seededRng(seed)
  const out = new Array(days).fill(0)

  switch (profile) {
    case 'viralSpike': {
      /* peakIdx ВСЕГДА в пределах [0, days-1] — иначе out[peakIdx] = undefined → NaN. */
      const rawPeak = Math.floor(days * (0.22 + rand() * 0.22))
      const peakIdx = Math.max(0, Math.min(days - 1, rawPeak))
      for (let i = 0; i < days; i += 1) {
        const dist = Math.abs(i - peakIdx)
        const sShape = i < peakIdx
          ? Math.exp(-Math.pow(dist / Math.max(1, peakIdx * 0.7), 2)) * 0.65 + 0.18
          : Math.exp(-dist * 0.055) * 0.95 + 0.18
        const noise = 0.9 + rand() * 0.2
        const weekend = ((startWeekday + i) % 7 >= 5) ? 1.12 : 1
        const tail = i > peakIdx ? 0.28 + rand() * 0.08 : 0
        out[i] = (sShape + tail) * noise * weekend * 10
        if (rand() < 0.05) out[i] *= 1.25
      }
      /* Сдержанный пик чтобы остальная динамика была видна */
      if (peakIdx < days) out[peakIdx] *= 1.18 + rand() * 0.15
      if (peakIdx + 1 < days) out[peakIdx + 1] *= 1.08
      break
    }
    case 'decayAfterPeak': {
      let level = 1.0 + rand() * 0.3
      /* Сильный долгосрочный floor: старые видео сохраняют ~40-50% относительной активности
         (real-world long-tail из плейлистов и рекомендаций). */
      const floor = 0.42 + rand() * 0.1
      for (let i = 0; i < days; i += 1) {
        level *= 0.985 + (rand() - 0.5) * 0.03
        const decay = Math.max(floor, level)
        const noise = 0.9 + rand() * 0.2
        const weekend = ((startWeekday + i) % 7 >= 5) ? 1.1 : 1
        out[i] = decay * noise * weekend
        if (rand() < 0.04) out[i] *= 1.3
      }
      break
    }
    case 'seasonal': {
      for (let i = 0; i < days; i += 1) {
        const wave = Math.sin((i / 7) * Math.PI * 2) * 0.4 + 1
        const slow = 0.85 + (i / days) * 0.4
        const noise = 0.9 + rand() * 0.2
        const weekend = ((startWeekday + i) % 7 >= 5) ? 1.15 : 1
        out[i] = wave * slow * noise * weekend
        if (rand() < 0.06) out[i] *= 1.35
        if (rand() < 0.04) out[i] *= 0.7
      }
      break
    }
    case 'steady': {
      let level = 1
      for (let i = 0; i < days; i += 1) {
        level = Math.max(0.4, level + (rand() - 0.5) * 0.22)
        const weekend = ((startWeekday + i) % 7 >= 5) ? 1.15 : 1
        const noise = 0.78 + rand() * 0.42
        out[i] = level * weekend * noise
        if (rand() < 0.12) out[i] *= 1.35
        if (rand() < 0.1) out[i] *= 0.7
      }
      break
    }
    case 'gradualGrowth':
    default: {
      let level = 0.55 + rand() * 0.2
      let regime = rand() > 0.45 ? 1 : -1
      let regimeLeft = 3 + Math.floor(rand() * 5)
      for (let i = 0; i < days; i += 1) {
        if (regimeLeft <= 0) {
          regime = rand() > 0.55 ? 1 : -1
          regimeLeft = 3 + Math.floor(rand() * 5)
        }
        regimeLeft -= 1
        const drift = regime * (0.012 + rand() * 0.022)
        const trendUp = (i / days) * 0.45
        level = Math.max(0.28, level + drift + (rand() - 0.5) * 0.18)
        const weekend = ((startWeekday + i) % 7 >= 5) ? 1.18 : 1
        let v = (level + trendUp) * (0.78 + rand() * 0.42) * weekend
        if (rand() < 0.14) v *= 1.45
        if (rand() < 0.12) v *= 0.6
        out[i] = Math.max(0.18, v)
      }
      break
    }
  }

  return out
}

/**
 * Сглаживание + нормализация: сумма === target.
 * Защита от NaN/undefined: всё нечисловое заменяем на 0.
 */
export function normalizeToTotal(arr, target) {
  if (arr.length === 0) return []
  const safe = arr.map((x) => (Number.isFinite(x) ? Math.max(0, x) : 0))
  const sum = safe.reduce((s, x) => s + x, 0)
  const safeTarget = Number.isFinite(target) ? target : 0
  if (sum <= 0) return safe.map(() => safeTarget / safe.length)
  return safe.map((x) => (x / sum) * safeTarget)
}

/**
 * Скользящее среднее по окну `window`. Сохраняет крайние точки (no shrinking).
 * Используем после агрегации канальной серии чтобы убрать резкие single-day спайки.
 * Защищено от NaN на входе.
 */
export function movingAverage(arr, window = 3) {
  if (arr.length === 0 || window <= 1) return arr
  const out = new Array(arr.length)
  const half = Math.floor(window / 2)
  for (let i = 0; i < arr.length; i += 1) {
    let sum = 0
    let count = 0
    for (let j = -half; j <= half; j += 1) {
      const idx = i + j
      if (idx >= 0 && idx < arr.length) {
        const v = arr[idx]
        if (Number.isFinite(v)) {
          sum += v
          count += 1
        }
      }
    }
    out[i] = count > 0 ? sum / count : 0
  }
  return out
}

/* === retention curve (per-video) === */
/**
 * 30 точек удержания (% аудитории, ось X = % длительности видео).
 * Стартует около 1.0, заканчивается ~0.30..0.45, с одним или двумя dip.
 */
export function generateRetention(seed) {
  const rand = seededRng(seed)
  const points = 30
  const out = []
  const initialDrop = 0.04 + rand() * 0.04
  const endValue = 0.28 + rand() * 0.18
  const dipAt = Math.floor(points * (0.25 + rand() * 0.5))
  const dipDepth = 0.08 + rand() * 0.07
  const start = 1 - initialDrop
  for (let i = 0; i < points; i += 1) {
    const t = i / (points - 1)
    let v = start + (endValue - start) * Math.pow(t, 1.18)
    if (i === dipAt) v -= dipDepth
    if (i === dipAt + 1) v -= dipDepth * 0.5
    v += (rand() - 0.5) * 0.018
    out.push({ pct: Math.round(t * 100), retained: Math.max(0, Math.min(1, v)) })
  }
  return out
}

/* === heatmap 7×24 (когда смотрят) === */
export function generateHourlyHeatmap(seed) {
  const rand = seededRng(seed)
  const matrix = Array.from({ length: 7 }, () => new Array(24).fill(0))
  for (let day = 0; day < 7; day += 1) {
    for (let h = 0; h < 24; h += 1) {
      let base = 0.18 + rand() * 0.12
      if (h >= 18 && h <= 22) base += 0.45 + rand() * 0.15
      else if (h >= 13 && h <= 17) base += 0.22 + rand() * 0.12
      else if (h >= 7 && h <= 12) base += 0.08 + rand() * 0.08
      else if (h >= 0 && h <= 5) base *= 0.55
      if (day === 5 || day === 6) {
        if (h >= 12 && h <= 22) base += 0.08
        if (h >= 0 && h <= 4) base *= 1.1
      }
      base *= 0.85 + rand() * 0.3
      matrix[day][h] = Math.max(0.04, Math.min(1, base))
    }
  }
  return matrix
}

/* === realtime tick === */
export function generateRealtimeMinute(seed, prev) {
  const rand = seededRng(seed)
  const base = prev > 0 ? prev : 35 + rand() * 25
  const noise = (rand() - 0.5) * 0.32
  const drift = (rand() - 0.48) * 0.08
  let next = base * (1 + noise + drift)
  if (rand() < 0.06) next *= 1 + (0.3 + rand() * 0.4)
  if (rand() < 0.05) next *= 0.65 + rand() * 0.2
  return Math.max(2, Math.round(next))
}

/* === segments / static-ish percentages with channel-level seed === */
export function generateTrafficShares(seed) {
  const rand = seededRng(seed)
  const a = [
    { key: 'search', label: 'Поиск на YouTube', base: 0.34 + rand() * 0.18 },
    { key: 'playlists', label: 'Плейлисты', base: 0.14 + rand() * 0.1 },
    { key: 'suggested', label: 'Подборка контента', base: 0.16 + rand() * 0.1 },
    { key: 'direct', label: 'Адресная строка / закладки', base: 0.05 + rand() * 0.06 },
    { key: 'external', label: 'Внешние источники', base: 0.04 + rand() * 0.06 },
    { key: 'other', label: 'Другое', base: 0.05 + rand() * 0.04 },
  ]
  const sum = a.reduce((s, x) => s + x.base, 0)
  return a.map((x) => ({ ...x, share: x.base / sum })).sort((p, q) => q.share - p.share)
}

export function generateDeviceShares(seed) {
  const rand = seededRng(seed)
  const a = [
    { key: 'mobile', label: 'Мобильный телефон', base: 0.4 + rand() * 0.18 },
    { key: 'desktop', label: 'Компьютер', base: 0.28 + rand() * 0.15 },
    { key: 'tv', label: 'ТВ', base: 0.05 + rand() * 0.07 },
    { key: 'tablet', label: 'Планшет', base: 0.02 + rand() * 0.04 },
    { key: 'console', label: 'Игровая приставка', base: 0.005 + rand() * 0.015 },
  ]
  const sum = a.reduce((s, x) => s + x.base, 0)
  return a.map((x) => ({ ...x, share: x.base / sum })).sort((p, q) => q.share - p.share)
}

export function generateGeoShares(seed, country = 'RU') {
  const rand = seededRng(seed)
  const homeCountry = {
    RU: 'Россия', US: 'США', DE: 'Германия', BR: 'Бразилия', IN: 'Индия',
  }[country] || 'Россия'
  const others = [
    'Украина', 'Беларусь', 'Казахстан', 'Германия', 'США', 'Узбекистан',
    'Польша', 'Великобритания', 'Латвия', 'Эстония',
  ].filter((x) => x !== homeCountry)
  const items = [
    { label: homeCountry, share: 0.42 + rand() * 0.22 },
    { label: others[0], share: 0.08 + rand() * 0.05 },
    { label: others[1], share: 0.06 + rand() * 0.05 },
    { label: others[2], share: 0.05 + rand() * 0.04 },
    { label: others[3], share: 0.04 + rand() * 0.03 },
    { label: others[4], share: 0.03 + rand() * 0.03 },
  ]
  const tail = 1 - items.reduce((s, x) => s + x.share, 0)
  if (tail > 0) items.push({ label: 'Другие страны', share: Math.max(0.02, tail) })
  const sum = items.reduce((s, x) => s + x.share, 0)
  return items.map((x) => ({ ...x, share: x.share / sum }))
}

export function generateAgeGender(seed) {
  const rand = seededRng(seed)
  const ageBuckets = ['13–17', '18–24', '25–34', '35–44', '45–54', '55–64', '65+']
  const ageWeights = [0.04 + rand() * 0.04, 0.22 + rand() * 0.1, 0.28 + rand() * 0.12, 0.18 + rand() * 0.08, 0.1 + rand() * 0.06, 0.05 + rand() * 0.04, 0.03 + rand() * 0.02]
  const sumW = ageWeights.reduce((s, x) => s + x, 0)
  const ages = ageBuckets.map((label, i) => ({ label, share: ageWeights[i] / sumW }))
  const malePct = 0.5 + (rand() - 0.5) * 0.55
  const genders = [
    { key: 'male', label: 'Мужчины', share: Math.max(0.05, Math.min(0.95, malePct)) },
    { key: 'female', label: 'Женщины', share: 1 - Math.max(0.05, Math.min(0.95, malePct)) - 0.02 },
    { key: 'unknown', label: 'Не определено', share: 0.02 },
  ]
  return { ages, genders }
}

export function generateLanguageShares(seed) {
  const rand = seededRng(seed)
  const a = [
    { label: 'Без субтитров', share: 0.55 + rand() * 0.15 },
    { label: 'Русский', share: 0.18 + rand() * 0.1 },
    { label: 'Английский', share: 0.08 + rand() * 0.07 },
    { label: 'Казахский', share: 0.02 + rand() * 0.03 },
    { label: 'Украинский', share: 0.015 + rand() * 0.02 },
  ]
  const sum = a.reduce((s, x) => s + x.share, 0)
  return a.map((x) => ({ ...x, share: x.share / sum }))
}

export function generateReturningSeries(seed, days, startWeekday = 0) {
  const rand = seededRng(seed)
  const out = []
  for (let i = 0; i < days; i += 1) {
    const newViewersRatio = 0.55 + (rand() - 0.5) * 0.18 + (i / days) * 0.12
    out.push({
      newRatio: Math.max(0.2, Math.min(0.92, newViewersRatio)),
      weekday: (startWeekday + i) % 7,
    })
  }
  return out
}
