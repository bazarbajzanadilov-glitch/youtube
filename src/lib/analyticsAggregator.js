/**
 * Канал-уровневый агрегатор. Принимает videos[] + channel + range,
 * возвращает структуру со всеми сериями для экранов аналитики/монетизации.
 *
 * Основной источник — сохранённые channel.videoDailyStats. Текущий и
 * предыдущий периоды суммируются из одних и тех же календарных строк.
 * Синтетическая lifetime-форма оставлена только для старых проектов,
 * у которых дневная история ещё полностью отсутствует.
 */

import {
  hashSeed, isoDay, addDays, daysBetween, startOfDay,
  toCalendarDate,
  generateDailyShape, generateLifecycleShape, normalizeToTotal, inferProfile,
  generateRetention, generateHourlyHeatmap,
  generateTrafficShares, generateDeviceShares, generateGeoShares,
  generateAgeGender, generateLanguageShares,
} from './analyticsEngine.js'
import { averageViewFraction } from './videoMetrics.js'

/* === range resolver === */

export const RANGE_OPTIONS = [
  { kind: '7d', label: 'Последние 7 дней', days: 7 },
  { kind: '28d', label: 'Последние 28 дней', days: 28 },
  { kind: '90d', label: 'Последние 90 дней', days: 90 },
  { kind: '365d', label: 'Последние 365 дней', days: 365 },
  { kind: 'lifetime', label: 'Все время', days: null },
  { kind: 'custom', label: 'Другой диапазон дат', days: null },
]

export const ANALYTICS_TIME_ZONE = 'Asia/Almaty'

const almatyDateParts = new Intl.DateTimeFormat('en-US', {
  timeZone: ANALYTICS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function getAlmatyCalendarDate(value = new Date()) {
  const instant = value instanceof Date ? value : new Date(value)
  const parts = Object.fromEntries(
    almatyDateParts
      .formatToParts(instant)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value: partValue }) => [type, Number(partValue)]),
  )
  return new Date(parts.year, parts.month - 1, parts.day)
}

export function getAnalyticsEndDate(today = new Date()) {
  return startOfDay(addDays(getAlmatyCalendarDate(today), -1))
}

export function resolveRange(range, videos, today = new Date(), channel = {}) {
  const todayD = getAnalyticsEndDate(today)
  const yearMatch = /^year-(\d{4})$/.exec(range?.kind || '')
  if (yearMatch) {
    const year = Number(yearMatch[1])
    const requestedFrom = startOfDay(new Date(year, 0, 1))
    const end = startOfDay(new Date(year, 11, 31))
    const to = end > todayD ? todayD : end
    const from = requestedFrom > to ? to : requestedFrom
    const days = Math.max(1, daysBetween(from, to) + 1)
    return { from, to, days, kind: range.kind, label: String(year) }
  }
  const monthMatch = /^month-(\d{4})-(\d{2})$/.exec(range?.kind || '')
  if (monthMatch) {
    const year = Number(monthMatch[1])
    const month = Number(monthMatch[2]) - 1
    const requestedFrom = startOfDay(new Date(year, month, 1))
    const end = startOfDay(new Date(year, month + 1, 0))
    const to = end > todayD ? todayD : end
    const from = requestedFrom > to ? to : requestedFrom
    const days = Math.max(1, daysBetween(from, to) + 1)
    return { from, to, days, kind: range.kind, label: range.label || `${year}-${monthMatch[2]}` }
  }
  if (range?.kind === 'custom' && range.from && range.to) {
    const requestedFrom = startOfDay(range.from)
    const requestedTo = startOfDay(range.to)
    const to = requestedTo > todayD ? todayD : requestedTo
    const from = requestedFrom > to ? to : requestedFrom
    const days = Math.max(1, daysBetween(from, to) + 1)
    return { from, to, days, kind: 'custom', label: 'Свой диапазон' }
  }
  if (range?.kind === 'lifetime') {
    let earliest = todayD
    for (const v of videos) {
      if (v.date) {
        const d = startOfDay(v.date)
        if (d < earliest) earliest = d
      }
    }
    for (const row of Array.isArray(channel?.subscriberDailyStats) ? channel.subscriberDailyStats : []) {
      if (row?.date) {
        const d = startOfDay(row.date)
        if (d < earliest) earliest = d
      }
    }
    for (const row of Array.isArray(channel?.videoDailyStats) ? channel.videoDailyStats : []) {
      if (row?.date) {
        const d = startOfDay(row.date)
        if (d < earliest) earliest = d
      }
    }
    /* Гарантируем минимум 7 дней (даже если все видео опубликованы сегодня).
       from смещаем назад от today чтобы dailyMap не уходил в будущее. */
    const ageDays = Math.max(0, daysBetween(earliest, todayD)) + 1
    const days = Math.max(7, ageDays)
    const from = startOfDay(addDays(todayD, -(days - 1)))
    return { from, to: todayD, days, kind: 'lifetime', label: 'За всё время' }
  }
  const opt = RANGE_OPTIONS.find((r) => r.kind === range?.kind) || RANGE_OPTIONS[1]
  const days = opt.days || 28
  const from = addDays(todayD, -(days - 1))
  return { from: startOfDay(from), to: todayD, days, kind: opt.kind, label: opt.label }
}

/* === per-day series builder === */

function buildDailyMap(from, days) {
  const dates = []
  const map = new Map()
  for (let i = 0; i < days; i += 1) {
    const d = addDays(from, i)
    const key = isoDay(d)
    dates.push({ date: key, weekday: d.getDay() })
    map.set(key, {
      date: key,
      views: 0,
      engagedViews: 0,
      watchTime: 0,
      impressions: 0,
      hasPersistedImpressions: false,
      revenue: 0,
      likes: 0,
      comments: 0,
      weekday: d.getDay(),
    })
  }
  return { dates, map }
}

const PERSISTED_DAILY_INDEX_KEY = Symbol('persisted-video-daily-index')

function normalizePersistedDailyRow(item) {
  const videoId = item?.videoId ?? item?.video_id
  const date = String(item?.date || '').slice(0, 10)
  if (videoId == null || !date) return null
  return {
    videoId: String(videoId),
    date,
    views: Math.max(0, Number(item.views) || 0),
    engagedViews: Math.max(
      0,
      Number(item.engagedViews ?? item.engaged_views) || 0,
    ),
    watchTime: Math.max(
      0,
      Number(item.watchSeconds ?? item.watch_seconds) || 0,
    ),
    impressions: Math.max(0, Number(item.impressions) || 0),
    likes: Math.max(0, Number(item.likes) || 0),
    comments: Math.max(0, Number(item.comments) || 0),
    revenue: Math.max(0, Number(item.revenue) || 0),
  }
}

function getPersistedDailyIndex(channel, cache) {
  if (cache?.has(PERSISTED_DAILY_INDEX_KEY)) {
    return cache.get(PERSISTED_DAILY_INDEX_KEY)
  }

  const sourceRows = Array.isArray(channel?.videoDailyStats)
    ? channel.videoDailyStats
    : []
  if (sourceRows.length === 0) {
    cache?.set(PERSISTED_DAILY_INDEX_KEY, null)
    return null
  }

  const byVideo = new Map()
  const rows = []
  for (const sourceRow of sourceRows) {
    const row = normalizePersistedDailyRow(sourceRow)
    if (!row) continue
    rows.push(row)
    if (!byVideo.has(row.videoId)) byVideo.set(row.videoId, [])
    byVideo.get(row.videoId).push(row)
  }
  for (const videoRows of byVideo.values()) {
    videoRows.sort((a, b) => a.date.localeCompare(b.date))
  }

  const index = rows.length > 0 ? { byVideo, rows } : null
  cache?.set(PERSISTED_DAILY_INDEX_KEY, index)
  return index
}

function attachPersistedVideoContribution({
  video,
  channel,
  range,
  dayMap,
  cache,
}) {
  const index = getPersistedDailyIndex(channel, cache)
  if (!index) return false

  for (const slot of dayMap.values()) {
    slot.hasPersistedImpressions = true
  }
  const rows = index.byVideo.get(String(video?.id)) || []
  const rangeFrom = isoDay(range.from)
  const publishDate = String(video.date).slice(0, 10)
  const from = publishDate > rangeFrom ? publishDate : rangeFrom
  const to = isoDay(range.to)
  for (const row of rows) {
    if (row.date < from || row.date > to) continue
    const slot = dayMap.get(row.date)
    if (!slot) continue
    slot.views += row.views
    slot.engagedViews += row.engagedViews
    slot.watchTime += row.watchTime
    slot.impressions += row.impressions
    slot.hasPersistedImpressions = true
    slot.revenue += row.revenue
    slot.likes += row.likes
    slot.comments += row.comments
  }
  return true
}

/**
 * Эффективный доход за видео: только явно проставленный video.revenue.
 */
export function effectiveRevenue(video) {
  const explicit = Math.max(0, Number(video.revenue) || 0)
  if (explicit > 0) return explicit
  return 0
}

/** Производное количество комментариев на основе просмотров. */
export function effectiveComments(video) {
  const views = Math.max(0, Number(video.views) || 0)
  if (views <= 0) return 0
  const rate = 0.006 + ((hashSeed(video.id, 'cm') % 100) / 100) * 0.012
  return Math.round(views * rate)
}

function distributeDiscreteTotal(values, total, precision = 0) {
  const factor = 10 ** precision
  const targetUnits = Math.max(0, Math.round((Number(total) || 0) * factor))
  if (!Array.isArray(values) || values.length === 0 || targetUnits === 0) {
    return new Array(Array.isArray(values) ? values.length : 0).fill(0)
  }

  const rawUnits = values.map((value) => Math.max(0, Number(value) || 0) * factor)
  const units = rawUnits.map(Math.floor)
  let remaining = targetUnits - units.reduce((sum, value) => sum + value, 0)
  const order = rawUnits
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)

  for (let index = 0; remaining > 0; index += 1) {
    units[order[index % order.length].index] += 1
    remaining -= 1
  }
  return units.map((value) => value / factor)
}

function allocateIntegerTotalByWeights(weights, total, tieBreakers = []) {
  const size = Array.isArray(weights) ? weights.length : 0
  const target = Math.max(0, Math.round(Number(total) || 0))
  if (size === 0 || target === 0) return new Array(size).fill(0)

  let safeWeights = weights.map((value) => Math.max(0, Number(value) || 0))
  let weightTotal = safeWeights.reduce((sum, value) => sum + value, 0)
  if (weightTotal <= 0) {
    safeWeights = safeWeights.map((_, index) => (index === 0 ? 1 : 0))
    weightTotal = 1
  }

  const exact = safeWeights.map((value) => (target * value) / weightTotal)
  const allocated = exact.map(Math.floor)
  let remaining = target - allocated.reduce((sum, value) => sum + value, 0)
  const order = exact
    .map((value, index) => ({
      index,
      remainder: value - Math.floor(value),
      tieBreaker: Number(tieBreakers[index]) || index,
    }))
    .sort((a, b) => (
      b.remainder - a.remainder
      || a.tieBreaker - b.tieBreaker
      || a.index - b.index
    ))

  for (let index = 0; remaining > 0; index += 1) {
    allocated[order[index % order.length].index] += 1
    remaining -= 1
  }
  return allocated
}

function distributeBoundedIntegerTotal(weights, total, capacities) {
  const size = Array.isArray(weights) ? weights.length : 0
  const target = Math.max(0, Math.round(Number(total) || 0))
  if (size === 0 || target === 0) return new Array(size).fill(0)

  const caps = Array.from({ length: size }, (_, index) => (
    Math.max(0, Math.floor(Number(capacities?.[index]) || 0))
  ))
  const capacityTotal = caps.reduce((sum, value) => sum + value, 0)
  if (target > capacityTotal) {
    return allocateIntegerTotalByWeights(weights, target)
  }

  const safeWeights = weights.map((value) => Math.max(0, Number(value) || 0))
  const allocated = new Array(size).fill(0)
  let remaining = target

  while (remaining > 0) {
    const active = allocated
      .map((value, index) => ({ index, capacity: caps[index] - value }))
      .filter((item) => item.capacity > 0)
    if (active.length === 0) break

    let weightTotal = active.reduce((sum, item) => sum + safeWeights[item.index], 0)
    const useCapacityWeights = weightTotal <= 0
    if (useCapacityWeights) {
      weightTotal = active.reduce((sum, item) => sum + item.capacity, 0)
    }

    const shares = active.map((item) => {
      const weight = useCapacityWeights ? item.capacity : safeWeights[item.index]
      const exact = (remaining * weight) / weightTotal
      const base = Math.min(item.capacity, Math.floor(exact))
      return {
        ...item,
        exact,
        base,
        remainder: exact - Math.floor(exact),
      }
    })
    let allocatedThisRound = 0
    shares.forEach((item) => {
      allocated[item.index] += item.base
      allocatedThisRound += item.base
    })
    remaining -= allocatedThisRound
    if (remaining <= 0) break

    const order = shares
      .filter((item) => allocated[item.index] < caps[item.index])
      .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
    let granted = 0
    for (const item of order) {
      if (remaining <= 0) break
      allocated[item.index] += 1
      remaining -= 1
      granted += 1
    }
    if (allocatedThisRound === 0 && granted === 0) break
  }

  return allocated
}

function videoContributionKey(video) {
  return [
    video?.id,
    video?.date,
    video?.views,
    video?.likes,
    video?.dislikes,
    video?.revenue,
    video?.duration,
    video?.averageViewPercentage,
    video?.type,
    video?.profile,
  ].join('|')
}

function prepareVideoContribution(video, channel, asOf, cache) {
  if (!video || !video.date) return null
  const today = startOfDay(asOf)
  const publish = startOfDay(video.date)
  if (publish > today) return null
  const cacheKey = videoContributionKey(video)
  const cached = cache?.get(cacheKey)
  if (cached) return cached

  const ageDays = Math.max(1, daysBetween(publish, today) + 1)
  const profile = video.profile || inferProfile(video, today)
  const seed = hashSeed(channel.channelName, video.id, profile, video.views || 0)
  const shape = generateLifecycleShape({
    seed,
    days: ageDays,
    profile,
    startWeekday: publish.getDay(),
  })
  const totalViews = Math.max(0, Number(video.views) || 0)
  const scaled = distributeDiscreteTotal(normalizeToTotal(shape, totalViews), totalViews)
  const totalRevenue = effectiveRevenue(video, channel)
  const revenueSeed = hashSeed(channel.channelName, video.id, 'revenue', totalRevenue)
  const revenueRand = seededRevenue(revenueSeed)
  const revenueShape = scaled.map((x, i) => {
    const ageBoost = i < 3 ? 0.82 + i * 0.08 : 1
    return x * ageBoost * (0.85 + revenueRand() * 0.35)
  })
  const revenueScaled = totalViews > 0 && totalRevenue > 0
    ? distributeDiscreteTotal(normalizeToTotal(revenueShape, totalRevenue), totalRevenue, 2)
    : new Array(scaled.length).fill(0)
  const totalLikes = Math.max(0, Number(video.likes) || 0)
  const likesRand = seededRevenue(hashSeed(channel.channelName, video.id, 'likes', totalLikes))
  const likesShape = scaled.map((views, index) => (
    views
    * (0.84 + likesRand() * 0.32)
    * (index < 3 ? 0.94 + index * 0.03 : 1)
  ))
  const likesScaled = totalViews > 0 && totalLikes > 0
    ? distributeBoundedIntegerTotal(
      likesShape,
      totalLikes,
      scaled,
    )
    : new Array(scaled.length).fill(0)
  const totalComments = effectiveComments(video)
  const commentsScaled = totalViews > 0 && totalComments > 0
    ? distributeDiscreteTotal(
      scaled.map((x) => (x / totalViews) * totalComments),
      totalComments,
    )
    : new Array(scaled.length).fill(0)
  const engagementFraction = Math.max(0, Math.min(
    1,
    Number(averageViewFraction(video)) || 0,
  ))
  const totalEngagedViews = Math.round(totalViews * engagementFraction)
  const engagementRand = seededRevenue(
    hashSeed(channel.channelName, video.id, 'engaged-views', totalEngagedViews),
  )
  const engagementShape = scaled.map((views, index) => (
    views
    * (0.88 + engagementRand() * 0.24)
    * (index < 3 ? 0.92 + index * 0.04 : 1)
  ))
  const engagedViewsScaled = totalViews > 0 && totalEngagedViews > 0
    ? distributeBoundedIntegerTotal(
      engagementShape,
      totalEngagedViews,
      scaled,
    )
    : new Array(scaled.length).fill(0)
  const durationSec = parseDuration(video.duration)
  const viewFraction = Math.max(0, Math.min(
    1,
    Number(averageViewFraction(video)) || 0,
  ))
  const totalWatchSeconds = Math.round(totalViews * durationSec * viewFraction)
  const watchSeed = hashSeed(
    channel.channelName,
    video.id,
    'watch-time',
    durationSec,
    Math.round(viewFraction * 10_000),
  )
  const watchPhaseA = ((watchSeed & 0xffff) / 0xffff) * Math.PI * 2
  const watchPhaseB = (((watchSeed >>> 16) & 0xffff) / 0xffff) * Math.PI * 2
  const watchShape = scaled.map((views, index) => {
    const longWave = Math.sin((Math.PI * 2 * index) / 19 + watchPhaseA)
    const shortWave = Math.sin((Math.PI * 2 * index) / 7 + watchPhaseB)
    const releaseAdjustment = index < 5 ? 0.94 + index * 0.015 : 1
    return views
      * durationSec
      * releaseAdjustment
      * Math.max(0.7, 1 + longWave * 0.14 + shortWave * 0.06)
  })
  const watchEachSec = totalViews > 0 && totalWatchSeconds > 0
    ? distributeBoundedIntegerTotal(
      watchShape,
      totalWatchSeconds,
      scaled.map((views) => Math.round(views * durationSec)),
    )
    : new Array(scaled.length).fill(0)
  const contribution = {
    publish,
    ageDays,
    scaled,
    revenueScaled,
    likesScaled,
    commentsScaled,
    engagedViewsScaled,
    watchEachSec,
  }
  cache?.set(cacheKey, contribution)
  return contribution
}

function attachVideoContribution({
  video,
  channel,
  range,
  dayMap,
  asOf = range.to,
  cache,
}) {
  if (!video?.date || startOfDay(video.date) > startOfDay(asOf)) return
  if (attachPersistedVideoContribution({
    video,
    channel,
    range,
    dayMap,
    cache,
  })) return

  const contribution = prepareVideoContribution(video, channel, asOf, cache)
  if (!contribution) return
  const {
    publish,
    ageDays,
    scaled,
    revenueScaled,
    likesScaled,
    commentsScaled,
    engagedViewsScaled,
    watchEachSec,
  } = contribution
  const firstIndex = Math.max(0, daysBetween(publish, range.from))
  const lastIndex = Math.min(ageDays - 1, daysBetween(publish, range.to))
  if (lastIndex < firstIndex) return
  for (let i = firstIndex; i <= lastIndex; i += 1) {
    const day = addDays(publish, i)
    const key = isoDay(day)
    const slot = dayMap.get(key)
    if (slot) {
      slot.views += scaled[i]
      slot.revenue += revenueScaled[i]
      slot.watchTime += watchEachSec[i]
      slot.likes += likesScaled[i]
      slot.comments += commentsScaled[i]
      slot.engagedViews += engagedViewsScaled[i]
    }
  }
}

function seededRevenue(seed) {
  let t = (Math.floor(seed) | 0) || 0x9e3779b9
  return () => {
    t = (t + 0x6d2b79f5) | 0
    let r = Math.imul(t ^ (t >>> 15), t | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function parseDuration(d) {
  if (!d) return 60
  const parts = String(d).split(':').map((x) => parseInt(x, 10) || 0)
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return parseInt(d, 10) || 60
}

function resolveVideoType(video) {
  if (['video', 'short', 'live'].includes(video?.type)) return video.type
  const title = String(video?.title || '').toLowerCase()
  if (title.includes('прямой эфир') || title.includes('live stream')) return 'live'
  if (parseDuration(video?.duration) <= 60) return 'short'
  return 'video'
}

/* === KPI delta vs previous period === */

function buildPrevSeries(videos, channel, range, asOf = range.to, cache) {
  const prevTo = addDays(range.from, -1)
  const prevFrom = addDays(prevTo, -(range.days - 1))
  const { map } = buildDailyMap(prevFrom, range.days)
  videos.forEach((v) => attachVideoContribution({
    video: v,
    channel,
    range: { from: prevFrom, to: prevTo, days: range.days },
    dayMap: map,
    asOf,
    cache,
  }))
  let views = 0
  let watch = 0
  let revenue = 0
  let impressions = 0
  let likes = 0
  let comments = 0
  let engagedViews = 0
  const channelSeed = hashSeed(
    channel.channelName || 'channel',
    channel.country || 'RU',
    'analytics',
  )
  for (const x of map.values()) {
    views += x.views
    watch += x.watchTime
    revenue += x.revenue
    impressions += x.hasPersistedImpressions
      ? x.impressions
      : (x.views > 0 ? x.views / Math.max(0.04, dailyCtrForRow(x, channelSeed)) : 0)
    likes += x.likes
    comments += x.comments
    engagedViews += x.engagedViews
  }
  return {
    views,
    watch,
    revenue,
    impressions,
    likes,
    comments,
    engagedViews,
  }
}

function pctDelta(curr, prev) {
  if (!prev) return curr > 0 ? null : 0
  const raw = ((curr - prev) / prev) * 100
  return raw
}

function bucketKey(dateIso, granularity) {
  const d = toCalendarDate(dateIso)
  if (granularity === 'week') {
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Понедельник
    const w = new Date(d.getFullYear(), d.getMonth(), diff)
    return isoDay(w)
  }
  if (granularity === 'month') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  }
  return dateIso
}

export function aggregateSubscriberSeries(daily, granularity) {
  if (granularity === 'day' || daily.length === 0) return daily
  const buckets = new Map()
  for (const row of daily) {
    const key = bucketKey(row.date, granularity)
    if (!buckets.has(key)) {
      buckets.set(key, { date: key, gained: 0, lost: 0, subscribers: 0 })
    }
    const bucket = buckets.get(key)
    bucket.gained += Math.max(0, Number(row.gained) || 0)
    bucket.lost += Math.max(0, Number(row.lost) || 0)
    bucket.subscribers = bucket.gained
  }
  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date))
}

export function buildSubscriberSeries(channel, dates) {
  const byDate = new Map()
  for (const item of Array.isArray(channel?.subscriberDailyStats) ? channel.subscriberDailyStats : []) {
    const date = String(item?.date || '').slice(0, 10)
    if (!date) continue
    const gained = Math.max(0, Number(item.gained) || 0)
    const lost = Math.max(0, Number(item.lost) || 0)
    byDate.set(date, { gained, lost })
  }

  return dates.flatMap(({ date }) => {
    const row = byDate.get(date)
    // A missing database row is stale history, not a real zero-growth day.
    // Supabase fills completed dates daily; omitting a missing point prevents
    // an infrastructure gap from being rendered as a subscriber collapse.
    if (!row) return []
    return {
      date,
      gained: row.gained,
      lost: row.lost,
      subscribers: row.gained,
    }
  })
}

const CONTENT_TYPE_KEYS = ['video', 'short', 'live', 'post']

function allocateSubscriberSeriesByType(series, weightsByType) {
  const result = Object.fromEntries(CONTENT_TYPE_KEYS.map((key) => [key, []]))
  const weights = CONTENT_TYPE_KEYS.map((key) => (
    Math.max(0, Number(weightsByType?.[key]) || 0)
  ))

  for (const row of series) {
    const tieBreakers = CONTENT_TYPE_KEYS.map((key) => (
      hashSeed(row.date, key, 'subscriber-allocation')
    ))
    const gained = allocateIntegerTotalByWeights(weights, row.gained, tieBreakers)
    const lost = allocateIntegerTotalByWeights(weights, row.lost, tieBreakers)
    const subscribers = allocateIntegerTotalByWeights(weights, row.subscribers, tieBreakers)
    CONTENT_TYPE_KEYS.forEach((key, index) => {
      result[key].push({
        ...row,
        gained: gained[index],
        lost: lost[index],
        subscribers: subscribers[index],
      })
    })
  }

  return result
}

function bucketSeries(series, granularity) {
  if (granularity === 'day' || series.length === 0) return series
  const buckets = new Map()
  for (const row of series) {
    const key = bucketKey(row.date, granularity)
    if (!buckets.has(key)) {
      buckets.set(key, {
        date: key,
        weekday: 0,
        views: 0,
        engagedViews: 0,
        watchTime: 0,
        impressions: 0,
        hasPersistedImpressions: false,
        revenue: 0,
        likes: 0,
        comments: 0,
      })
    }
    const b = buckets.get(key)
    b.views += row.views
    b.watchTime += row.watchTime
    b.impressions += Math.max(0, Number(row.impressions) || 0)
    b.hasPersistedImpressions ||= Boolean(row.hasPersistedImpressions)
    b.revenue += row.revenue
    b.likes += row.likes
    b.comments += row.comments
    b.engagedViews += row.engagedViews
  }
  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date)).map((b) => ({
    ...b,
    revenue: +b.revenue.toFixed(2),
  }))
}

function bucketNewReturningSeries(series, granularity) {
  if (granularity === 'day' || series.length === 0) return series
  const buckets = new Map()
  series.forEach((row) => {
    const key = bucketKey(row.date, granularity)
    if (!buckets.has(key)) {
      buckets.set(key, { date: key, new: 0, returning: 0 })
    }
    const bucket = buckets.get(key)
    bucket.new += Math.max(0, Number(row.new) || 0)
    bucket.returning += Math.max(0, Number(row.returning) || 0)
  })
  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date))
}

function buildSeriesForVideos(
  videos,
  channel,
  range,
  granularity,
  asOf = range.to,
  cache,
) {
  const { dates, map } = buildDailyMap(range.from, range.days)
  videos.forEach((video) => attachVideoContribution({
    video,
    channel,
    range,
    dayMap: map,
    asOf,
    cache,
  }))
  const dailySeries = dates.map(({ date, weekday }) => {
    const slot = map.get(date)
    return {
      date,
      weekday,
      views: +slot.views.toFixed(3),
      engagedViews: +slot.engagedViews.toFixed(3),
      watchTime: +slot.watchTime.toFixed(3),
      impressions: +slot.impressions.toFixed(3),
      hasPersistedImpressions: slot.hasPersistedImpressions,
      revenue: +slot.revenue.toFixed(2),
      likes: +slot.likes.toFixed(3),
      comments: +slot.comments.toFixed(3),
    }
  })
  return bucketSeries(dailySeries, granularity)
}

function buildVideoPeriodMetrics(videos, channel, range, asOf, cache) {
  return videos.map((video) => {
    const series = buildSeriesForVideos([video], channel, range, 'day', asOf, cache)
    return {
      ...video,
      periodViews: Math.round(series.reduce((sum, row) => sum + row.views, 0)),
      periodWatchTime: Math.round(series.reduce((sum, row) => sum + row.watchTime, 0)),
      periodRevenue: +series.reduce((sum, row) => sum + row.revenue, 0).toFixed(2),
      periodLikes: Math.round(series.reduce((sum, row) => sum + row.likes, 0)),
      periodComments: Math.round(series.reduce((sum, row) => sum + row.comments, 0)),
    }
  })
}

function reconcileIntegerMetric(items, key, target) {
  const reconciled = items.map((item) => ({ ...item }))
  const order = reconciled
    .map((item, index) => ({ index, value: Math.max(0, Number(item[key]) || 0) }))
    .sort((a, b) => b.value - a.value || a.index - b.index)
  if (order.length === 0) return reconciled

  const delta = Math.round(Number(target) || 0) - reconciled.reduce(
    (sum, item) => sum + Math.max(0, Math.round(Number(item[key]) || 0)),
    0,
  )

  if (delta > 0) {
    for (let offset = 0; offset < delta; offset += 1) {
      const targetIndex = order[offset % order.length].index
      const current = Math.max(0, Math.round(Number(reconciled[targetIndex][key]) || 0))
      reconciled[targetIndex][key] = current + 1
    }
  } else if (delta < 0) {
    let remaining = -delta
    for (const item of order) {
      if (remaining <= 0) break
      const current = Math.max(0, Math.round(Number(reconciled[item.index][key]) || 0))
      const reduction = Math.min(current, remaining)
      reconciled[item.index][key] = current - reduction
      remaining -= reduction
    }
  }
  return reconciled
}

function buildDailyNewReturningSeries(dailySeries, channelSeed) {
  return dailySeries.map((row) => {
    const rand = seededRevenue(hashSeed(channelSeed, row.date, 'audience-split'))
    const ratio = Math.max(0.2, Math.min(0.92, 0.61 + (rand() - 0.5) * 0.18))
    const newViews = Math.round(row.views * ratio)
    return {
      date: row.date,
      new: newViews,
      returning: Math.max(0, row.views - newViews),
    }
  })
}

function aggregateDatedShares(dailySeries, seed, generator) {
  const totals = new Map()
  let totalWeight = 0
  dailySeries.forEach((row) => {
    const weight = Math.max(0, Number(row.views) || 0)
    if (weight <= 0) return
    totalWeight += weight
    generator(hashSeed(seed, row.date, 'period-share')).forEach((item) => {
      const key = item.key || item.label
      const current = totals.get(key) || {
        key: item.key,
        label: item.label,
        weightedShare: 0,
      }
      current.weightedShare += (Number(item.share) || 0) * weight
      totals.set(key, current)
    })
  })
  if (totalWeight <= 0) return []
  const rows = Array.from(totals.values()).map((item) => ({
    key: item.key,
    label: item.label,
    share: item.weightedShare / totalWeight,
  }))
  const shareSum = rows.reduce((sum, row) => sum + row.share, 0) || 1
  return rows
    .map((row) => ({ ...row, share: row.share / shareSum }))
    .sort((a, b) => b.share - a.share)
}

function aggregateDatedAgeGender(dailySeries, seed) {
  return {
    ages: aggregateDatedShares(
      dailySeries,
      seed,
      (dailySeed) => generateAgeGender(dailySeed).ages,
    ),
    genders: aggregateDatedShares(
      dailySeries,
      seed + 1,
      (dailySeed) => generateAgeGender(dailySeed).genders,
    ),
  }
}

function aggregateDatedHeatmap(dailySeries, seed) {
  const matrix = Array.from({ length: 7 }, () => new Array(24).fill(0))
  let totalWeight = 0
  dailySeries.forEach((row) => {
    const weight = Math.max(0, Number(row.views) || 0)
    if (weight <= 0) return
    totalWeight += weight
    const dailyMatrix = generateHourlyHeatmap(hashSeed(seed, row.date, 'heatmap'))
    for (let day = 0; day < 7; day += 1) {
      for (let hour = 0; hour < 24; hour += 1) {
        matrix[day][hour] += dailyMatrix[day][hour] * weight
      }
    }
  })
  if (totalWeight <= 0) return matrix
  return matrix.map((row) => row.map((value) => value / totalWeight))
}

function dailyCtrForRow(row, seed) {
  const dailySeed = hashSeed(seed, row.date, 'ctr')
  return 0.082 + ((dailySeed % 1000) / 1000) * 0.06
}

function buildContentMetricSeries(dailySeries, granularity, seed) {
  const daily = dailySeries.map((row) => {
    const views = Math.max(0, Number(row.views) || 0)
    const watchTime = Math.max(0, Number(row.watchTime) || 0)
    const generatedCtr = dailyCtrForRow(row, seed)
    const impressions = row.hasPersistedImpressions
      ? Math.max(0, Number(row.impressions) || 0)
      : (views > 0 ? views / Math.max(0.04, generatedCtr) : 0)

    return {
      ...row,
      impressions,
      ctr: impressions > 0 ? (views / impressions) * 100 : 0,
      averageViewDuration: views > 0 ? watchTime / views : 0,
    }
  })

  if (granularity === 'day' || daily.length === 0) return daily

  const buckets = new Map()
  for (const row of daily) {
    const key = bucketKey(row.date, granularity)
    if (!buckets.has(key)) {
      buckets.set(key, {
        date: key,
        weekday: 0,
        views: 0,
        engagedViews: 0,
        watchTime: 0,
        revenue: 0,
        likes: 0,
        comments: 0,
        impressions: 0,
        hasPersistedImpressions: false,
      })
    }
    const bucket = buckets.get(key)
    bucket.views += Math.max(0, Number(row.views) || 0)
    bucket.engagedViews += Math.max(0, Number(row.engagedViews) || 0)
    bucket.watchTime += Math.max(0, Number(row.watchTime) || 0)
    bucket.revenue += Math.max(0, Number(row.revenue) || 0)
    bucket.likes += Math.max(0, Number(row.likes) || 0)
    bucket.comments += Math.max(0, Number(row.comments) || 0)
    bucket.impressions += Math.max(0, Number(row.impressions) || 0)
    bucket.hasPersistedImpressions ||= Boolean(row.hasPersistedImpressions)
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => ({
      ...row,
      revenue: +row.revenue.toFixed(2),
      ctr: row.impressions > 0 ? (row.views / row.impressions) * 100 : 0,
      averageViewDuration: row.views > 0 ? row.watchTime / row.views : 0,
    }))
}

function buildPeriodCtr(dailySeries, seed) {
  let views = 0
  let impressions = 0
  let hasPersistedImpressions = false
  dailySeries.forEach((row) => {
    const dailyViews = Math.max(0, Number(row.views) || 0)
    const dailyCtr = dailyCtrForRow(row, seed)
    const dailyImpressions = row.hasPersistedImpressions
      ? Math.max(0, Number(row.impressions) || 0)
      : (dailyViews > 0 ? dailyViews / Math.max(0.04, dailyCtr) : 0)
    views += dailyViews
    impressions += dailyImpressions
    hasPersistedImpressions ||= Boolean(row.hasPersistedImpressions)
  })
  if (impressions <= 0 && hasPersistedImpressions) return 0
  if (views <= 0 || impressions <= 0) {
    return 0.082 + ((seed % 1000) / 1000) * 0.06
  }
  return views / impressions
}

function buildRollingMonthlyViewersSeries(
  videos,
  channel,
  range,
  granularity,
  asOf,
  cache,
) {
  const rollingDays = 28
  const extendedRange = {
    from: addDays(range.from, -(rollingDays - 1)),
    to: range.to,
    days: range.days + rollingDays - 1,
  }
  const daily = buildSeriesForVideos(videos, channel, extendedRange, 'day', asOf, cache)
  const rolling = []
  let rollingViews = 0

  daily.forEach((row, index) => {
    rollingViews += Math.max(0, Number(row.views) || 0)
    if (index >= rollingDays) {
      rollingViews -= Math.max(0, Number(daily[index - rollingDays].views) || 0)
    }
    if (index >= rollingDays - 1) {
      rolling.push({
        date: row.date,
        viewers: Math.max(0, Math.round(rollingViews * 0.7 * 0.85)),
      })
    }
  })

  if (granularity === 'day') return rolling
  const buckets = new Map()
  rolling.forEach((row) => {
    buckets.set(bucketKey(row.date, granularity), row)
  })
  return Array.from(buckets.entries()).map(([date, row]) => ({
    date,
    viewers: row.viewers,
  }))
}

function buildRealtimeBaseline(videos, channel, today, asOf, cache) {
  const range = resolveRange({ kind: '28d' }, videos, today, channel)
  const periodVideos = buildVideoPeriodMetrics(videos, channel, range, asOf, cache)
  const totalViews = periodVideos.reduce(
    (sum, video) => sum + Math.max(0, Number(video.periodViews) || 0),
    0,
  )
  return { totalViews, days: range.days, periodVideos }
}

function resolveSixMonthRange(today) {
  const to = getAnalyticsEndDate(today)
  const from = startOfDay(new Date(to.getFullYear(), to.getMonth() - 5, 1))
  return {
    from,
    to,
    days: Math.max(1, daysBetween(from, to) + 1),
    kind: 'fixed-6-months',
    label: 'Последние 6 месяцев',
  }
}

function allocateRealtimeVideoViews(videos, totalViews) {
  const safeTotal = Math.max(0, Math.round(Number(totalViews) || 0))
  const totalWeight = videos.reduce(
    (sum, video) => sum + Math.max(0, Number(video.periodViews) || 0),
    0,
  )
  if (safeTotal === 0 || totalWeight === 0) {
    return videos.map((video) => ({ ...video, realtimeViews: 0 }))
  }

  const allocated = videos.map((video, index) => {
    const raw = (safeTotal * Math.max(0, Number(video.periodViews) || 0)) / totalWeight
    return {
      index,
      value: Math.floor(raw),
      remainder: raw - Math.floor(raw),
    }
  })
  let residual = safeTotal - allocated.reduce((sum, item) => sum + item.value, 0)
  const byRemainder = [...allocated].sort((a, b) => (
    b.remainder - a.remainder || a.index - b.index
  ))
  for (let index = 0; index < byRemainder.length && residual > 0; index += 1) {
    allocated[byRemainder[index].index].value += 1
    residual -= 1
  }
  return videos.map((video, index) => ({
    ...video,
    realtimeViews: allocated[index].value,
  }))
}

/**
 * Lifetime итоги — это «правда» канала. Они должны совпадать с Dashboard
 * (Screen1Dashboard) — иначе видна десинхронизация. При range='lifetime'
 * период-серия равна lifetime; для других range — выводятся как hint.
 */
function computeLifetime(videos, channel, asOf, cache) {
  const persisted = getPersistedDailyIndex(channel, cache)
  if (persisted) {
    const asOfDate = isoDay(asOf)
    const eligibleVideos = videos.filter(
      (video) => video?.date && startOfDay(video.date) <= asOf,
    )
    const videoIds = new Set(eligibleVideos.map((video) => String(video.id)))
    const totals = persisted.rows.reduce((result, row) => {
      if (!videoIds.has(row.videoId) || row.date > asOfDate) return result
      result.views += row.views
      result.likes += row.likes
      result.revenue += row.revenue
      result.comments += row.comments
      result.watchSec += row.watchTime
      return result
    }, {
      views: 0,
      likes: 0,
      revenue: 0,
      comments: 0,
      watchSec: 0,
    })
    return {
      views: Math.round(totals.views),
      likes: Math.round(totals.likes),
      revenue: +totals.revenue.toFixed(2),
      comments: Math.round(totals.comments),
      watchHours: totals.watchSec / 3600,
      videos: eligibleVideos.length,
    }
  }

  let views = 0
  let likes = 0
  let revenue = 0
  let comments = 0
  let watchSec = 0
  let videoCount = 0
  for (const v of videos) {
    if (!v?.date || startOfDay(v.date) > asOf) continue
    videoCount += 1
    const vv = Math.max(0, Number(v.views) || 0)
    views += vv
    likes += Math.max(0, Number(v.likes) || 0)
    revenue += effectiveRevenue(v, channel)
    comments += effectiveComments(v)
    watchSec += vv * parseDuration(v.duration) * (averageViewFraction(v) ?? 0)
  }
  return {
    views,
    likes,
    revenue: +revenue.toFixed(2),
    comments,
    watchHours: watchSec / 3600,
    videos: videoCount,
  }
}

/* === main builder === */

export function build(videosInput, channelInput, rangeInput, options = {}) {
  const videos = Array.isArray(videosInput) ? videosInput : []
  const channel = channelInput || {}
  const today = options.today || new Date()
  const asOf = getAnalyticsEndDate(today)
  const range = resolveRange(rangeInput, videos, today, channel)
  const channelSeed = hashSeed(channel.channelName || 'channel', channel.country || 'RU', 'analytics')
  const contributionCache = new Map()
  const usesPersistedDailyHistory = Boolean(
    getPersistedDailyIndex(channel, contributionCache),
  )

  const lifetime = computeLifetime(videos, channel, asOf, contributionCache)
  const { dates, map } = buildDailyMap(range.from, range.days)
  videos.forEach((v) => attachVideoContribution({
    video: v,
    channel,
    range,
    dayMap: map,
    asOf,
    cache: contributionCache,
  }))

  /* Канонические дневные слоты строятся один раз относительно общей даты среза.
     Поэтому одна и та же календарная дата не меняет значение при выборе другого
     диапазона, а длинные периоды отличаются только агрегацией. */
  const rawViews = dates.map(({ date }) => map.get(date).views)
  const rawWatch = dates.map(({ date }) => map.get(date).watchTime)
  const rawRev = dates.map(({ date }) => map.get(date).revenue)
  const rawLikes = dates.map(({ date }) => map.get(date).likes)
  const rawComm = dates.map(({ date }) => map.get(date).comments)

  const dailySeries = dates.map(({ date, weekday }, i) => ({
    date,
    weekday,
    views: Math.round(rawViews[i]),
    engagedViews: Math.round(map.get(date).engagedViews),
    watchTime: +rawWatch[i].toFixed(3),
    impressions: +map.get(date).impressions.toFixed(3),
    hasPersistedImpressions: map.get(date).hasPersistedImpressions,
    revenue: +rawRev[i].toFixed(2),
    likes: Math.round(rawLikes[i]),
    comments: Math.round(rawComm[i]),
  }))
  /* Бакетинг: для длинных диапазонов аггрегируем по неделям/месяцам, чтобы чарт был
     читаемым (а не плоской линией с одним всплеском в конце). */
  const granularity = range.days <= 56 ? 'day' : range.days <= 240 ? 'week' : 'month'
  const series = bucketSeries(dailySeries, granularity)
  const dailyNewReturning = buildDailyNewReturningSeries(dailySeries, channelSeed)
  const newReturning = bucketNewReturningSeries(dailyNewReturning, granularity)
  const returningViews = dailyNewReturning.reduce((sum, row) => sum + row.returning, 0)
  const audienceViews = dailyNewReturning.reduce(
    (sum, row) => sum + row.new + row.returning,
    0,
  )
  const returningPercent = audienceViews > 0
    ? Math.round((returningViews / audienceViews) * 100)
    : 0
  const monthlyViewersSeries = buildRollingMonthlyViewersSeries(
    videos,
    channel,
    range,
    granularity,
    asOf,
    contributionCache,
  )
  const monthlyViewers = monthlyViewersSeries[monthlyViewersSeries.length - 1]?.viewers || 0

  const isLifetime = range.kind === 'lifetime'
  const totalViewsRaw = series.reduce((s, x) => s + x.views, 0)
  const totalEngagedViewsRaw = series.reduce((s, x) => s + x.engagedViews, 0)
  const totalLikesRaw = series.reduce((s, x) => s + x.likes, 0)
  const totalCommentsRaw = series.reduce((s, x) => s + x.comments, 0)
  const totalWatchSec = series.reduce((s, x) => s + x.watchTime, 0)
  const totalRevenueRaw = series.reduce((s, x) => s + x.revenue, 0)

  const totalViews = totalViewsRaw
  const totalEngagedViews = totalEngagedViewsRaw
  const totalLikes = totalLikesRaw
  const totalComments = totalCommentsRaw
  const totalRevenue = +totalRevenueRaw.toFixed(2)
  const totalWatchHours = totalWatchSec / 3600

  const periodVideos = reconcileIntegerMetric(
    buildVideoPeriodMetrics(videos, channel, range, asOf, contributionCache),
    'periodViews',
    totalViews,
  )
  const videosWithKnownRetention = periodVideos.filter(
    (video) => averageViewFraction(video) != null,
  )
  const allViewsForDuration = videosWithKnownRetention.reduce(
    (sum, video) => sum + (Number(video.periodViews) || 0),
    0,
  )
  const allWatchSec = videosWithKnownRetention.reduce(
    (sum, video) => (
      sum
      + (Number(video.periodViews) || 0)
      * parseDuration(video.duration)
      * averageViewFraction(video)
    ),
    0,
  )
  const avgDurationSec = usesPersistedDailyHistory
    ? (totalViews > 0 ? totalWatchSec / totalViews : 0)
    : (allViewsForDuration > 0 ? allWatchSec / allViewsForDuration : 0)

  const videosByType = {
    video: periodVideos.filter((video) => resolveVideoType(video) === 'video'),
    short: periodVideos.filter((video) => resolveVideoType(video) === 'short'),
    live: periodVideos.filter((video) => resolveVideoType(video) === 'live'),
  }
  const dailySeriesByType = {
    video: buildSeriesForVideos(
      videosByType.video,
      channel,
      range,
      'day',
      asOf,
      contributionCache,
    ),
    short: buildSeriesForVideos(
      videosByType.short,
      channel,
      range,
      'day',
      asOf,
      contributionCache,
    ),
    live: buildSeriesForVideos(
      videosByType.live,
      channel,
      range,
      'day',
      asOf,
      contributionCache,
    ),
  }
  const seriesByType = Object.fromEntries(
    Object.entries(dailySeriesByType).map(([key, rows]) => [
      key,
      bucketSeries(rows, granularity),
    ]),
  )
  const contentMetricSeries = buildContentMetricSeries(
    dailySeries,
    granularity,
    channelSeed,
  )
  const contentMetricSeriesByType = Object.fromEntries(
    Object.entries(dailySeriesByType).map(([key, rows]) => [
      key,
      buildContentMetricSeries(
        rows,
        granularity,
        hashSeed(channelSeed, key, 'ctr'),
      ),
    ]),
  )

  const prev = buildPrevSeries(videos, channel, range, asOf, contributionCache)
  const prevByType = Object.fromEntries(
    Object.entries(videosByType).map(([key, rows]) => [
      key,
      buildPrevSeries(rows, channel, range, asOf, contributionCache),
    ]),
  )
  const prevWatchHours = prev.watch / 3600
  const prevAverageViewDuration = prev.views > 0 ? prev.watch / prev.views : 0
  const prevCtrPercent = prev.impressions > 0
    ? (prev.views / prev.impressions) * 100
    : 0
  const subscribersDaily = buildSubscriberSeries(channel, dates)
  const subscribers = aggregateSubscriberSeries(subscribersDaily, granularity)
  const subscribersGained = subscribersDaily.reduce((sum, row) => sum + row.gained, 0)
  const subscribersLost = subscribersDaily.reduce((sum, row) => sum + row.lost, 0)
  const subscribersValue = subscribersDaily.reduce((sum, row) => sum + row.subscribers, 0)
  const previousSubscriberDates = buildDailyMap(addDays(range.from, -range.days), range.days).dates
  const previousSubscribersDaily = buildSubscriberSeries(channel, previousSubscriberDates)
  const previousSubscribers = aggregateSubscriberSeries(previousSubscribersDaily, granularity)
  const previousSubscribersValue = previousSubscribersDaily
    .reduce((sum, row) => sum + row.subscribers, 0)
  const subscribersDelta = isLifetime ? null : pctDelta(subscribersValue, previousSubscribersValue)
  const currentTypeViews = Object.fromEntries(CONTENT_TYPE_KEYS.map((key) => [
    key,
    (contentMetricSeriesByType[key] || []).reduce(
      (sum, row) => sum + (Number(row.views) || 0),
      0,
    ),
  ]))
  const previousTypeViews = Object.fromEntries(CONTENT_TYPE_KEYS.map((key) => [
    key,
    Math.max(0, Number(prevByType[key]?.views) || 0),
  ]))
  const subscribersByType = allocateSubscriberSeriesByType(subscribers, currentTypeViews)
  const previousSubscribersByType = allocateSubscriberSeriesByType(
    previousSubscribers,
    previousTypeViews,
  )
  const contentKpisByType = Object.fromEntries(
    CONTENT_TYPE_KEYS.map((key) => {
      const rows = contentMetricSeriesByType[key] || []
      const typeViews = rows.reduce((sum, row) => sum + (Number(row.views) || 0), 0)
      const typeEngagedViews = rows.reduce(
        (sum, row) => sum + (Number(row.engagedViews) || 0),
        0,
      )
      const typeLikes = rows.reduce((sum, row) => sum + (Number(row.likes) || 0), 0)
      const previous = prevByType[key] || {}
      const attributedSubscribers = (subscribersByType[key] || []).reduce(
        (sum, row) => sum + (Number(row.subscribers) || 0),
        0,
      )
      const previousAttributedSubscribers = (previousSubscribersByType[key] || []).reduce(
        (sum, row) => sum + (Number(row.subscribers) || 0),
        0,
      )

      return [key, {
        views: {
          value: Math.round(typeViews),
          delta: isLifetime ? null : pctDelta(typeViews, previous.views),
          previousValue: Number(previous.views) || 0,
        },
        engagedViews: {
          value: Math.round(typeEngagedViews),
          delta: isLifetime
            ? null
            : pctDelta(typeEngagedViews, previous.engagedViews),
          previousValue: Number(previous.engagedViews) || 0,
        },
        likes: {
          value: Math.round(typeLikes),
          delta: isLifetime ? null : pctDelta(typeLikes, previous.likes),
          previousValue: Number(previous.likes) || 0,
        },
        subscribers: {
          value: attributedSubscribers,
          delta: isLifetime
            ? null
            : pctDelta(attributedSubscribers, previousAttributedSubscribers),
          previousValue: previousAttributedSubscribers,
        },
      }]
    }),
  )

  const traffic = aggregateDatedShares(
    dailySeries,
    channelSeed,
    generateTrafficShares,
  )
  const trafficByType = Object.fromEntries(
    Object.entries(dailySeriesByType).map(([key, rows]) => [
      key,
      aggregateDatedShares(
        rows,
        hashSeed(channelSeed, key, 'traffic'),
        generateTrafficShares,
      ),
    ]),
  )
  const devices = aggregateDatedShares(
    dailySeries,
    channelSeed + 1,
    generateDeviceShares,
  )
  const geography = aggregateDatedShares(
    dailySeries,
    channelSeed + 2,
    (seed) => generateGeoShares(seed, channel.country || 'RU'),
  )
  const ageGender = aggregateDatedAgeGender(dailySeries, channelSeed + 3)
  const languages = aggregateDatedShares(
    dailySeries,
    channelSeed + 4,
    generateLanguageShares,
  )
  const heatmap = aggregateDatedHeatmap(dailySeries, channelSeed + 5)

  const ctr = buildPeriodCtr(dailySeries, channelSeed)
  const ctrByType = Object.fromEntries(
    Object.entries(dailySeriesByType).map(([key, rows]) => [
      key,
      rows.some((row) => (Number(row.views) || 0) > 0)
        ? buildPeriodCtr(rows, hashSeed(channelSeed, key, 'ctr')) * 100
        : 0,
    ]),
  )
  const impressions = Math.round(contentMetricSeries.reduce(
    (sum, row) => sum + Math.max(0, Number(row.impressions) || 0),
    0,
  ))

  const retentionVideos = videos
    .filter((video) => video?.date && startOfDay(video.date) <= asOf)
    .slice(0, 6)
    .map((v) => ({
      videoId: v.id,
      title: v.title,
      curve: generateRetention(hashSeed(v.id, 'retention')),
    }))
  const channelRetention = generateRetention(channelSeed + 7)

  /* realtime: 48h, частица в час, последний бар = текущий */
  const realtimeBaseline = buildRealtimeBaseline(
    videos,
    channel,
    today,
    asOf,
    contributionCache,
  )
  const realtimeSeed = hashSeed(
    channel.channelName || 'channel',
    channel.country || 'RU',
    'realtime-48h',
  )
  const realtimeCore = buildRealtime(
    realtimeSeed,
    realtimeBaseline.totalViews,
    realtimeBaseline.days,
  )
  const realtimeTotalViews = realtimeCore.last48.reduce((sum, value) => sum + value, 0)
  const realtimeVideos = allocateRealtimeVideoViews(
    realtimeBaseline.periodVideos,
    realtimeTotalViews,
  )
  const realtime = {
    ...realtimeCore,
    topVideos: [...realtimeVideos]
      .filter((video) => video.realtimeViews > 0)
      .sort((a, b) => b.realtimeViews - a.realtimeViews)
      .slice(0, 10),
  }

  /* monetization split */
  const sixMonthRange = resolveSixMonthRange(today)
  const sixMonthSeries = buildSeriesForVideos(
    videos,
    channel,
    sixMonthRange,
    'month',
    asOf,
    contributionCache,
  )
  const sixMonthSeriesByType = {
    video: buildSeriesForVideos(
      videosByType.video,
      channel,
      sixMonthRange,
      'month',
      asOf,
      contributionCache,
    ),
    short: buildSeriesForVideos(
      videosByType.short,
      channel,
      sixMonthRange,
      'month',
      asOf,
      contributionCache,
    ),
    live: buildSeriesForVideos(
      videosByType.live,
      channel,
      sixMonthRange,
      'month',
      asOf,
      contributionCache,
    ),
  }
  const monetization = buildMonetization({
    channel,
    channelSeed,
    series,
    sixMonthSeries,
    sixMonthSeriesByType,
    totalRevenue,
    totalViews,
    prev,
    isLifetime,
  })

  const kpis = {
    overview: {
      views: {
        value: totalViews,
        delta: isLifetime ? null : pctDelta(totalViews, prev.views),
        previousValue: prev.views,
        lifetime: lifetime.views,
      },
      watchTime: {
        value: totalWatchHours,
        delta: isLifetime ? null : pctDelta(totalWatchHours, prevWatchHours),
        previousValue: prevWatchHours,
        lifetime: lifetime.watchHours,
      },
      subscribers: {
        value: subscribersValue,
        delta: subscribersDelta,
        previousValue: previousSubscribersValue,
        gained: subscribersGained,
        lost: subscribersLost,
        absolute: channel.subscriberCount || 0,
      },
      likes: {
        value: totalLikes,
        delta: isLifetime ? null : pctDelta(totalLikes, prev.likes),
        lifetime: lifetime.likes,
      },
      comments: {
        value: totalComments,
        delta: isLifetime ? null : pctDelta(totalComments, prev.comments),
        lifetime: lifetime.comments,
      },
      avgDuration: {
        value: avgDurationSec,
        delta: isLifetime ? null : pctDelta(avgDurationSec, prevAverageViewDuration),
        previousValue: prevAverageViewDuration,
      },
    },
    content: {
      views: {
        value: totalViews,
        delta: isLifetime ? null : pctDelta(totalViews, prev.views),
        previousValue: prev.views,
        lifetime: lifetime.views,
      },
      engagedViews: {
        value: totalEngagedViews,
        delta: isLifetime ? null : pctDelta(totalEngagedViews, prev.engagedViews),
        previousValue: prev.engagedViews,
      },
      likes: {
        value: totalLikes,
        delta: isLifetime ? null : pctDelta(totalLikes, prev.likes),
        previousValue: prev.likes,
        lifetime: lifetime.likes,
      },
      subscribers: {
        value: subscribersValue,
        delta: subscribersDelta,
        previousValue: previousSubscribersValue,
        gained: subscribersGained,
        lost: subscribersLost,
        absolute: channel.subscriberCount || 0,
      },
      impressions: {
        value: impressions,
        delta: isLifetime ? null : pctDelta(impressions, prev.impressions),
        previousValue: prev.impressions,
      },
      ctr: {
        value: ctr * 100,
        delta: isLifetime ? null : pctDelta(ctr * 100, prevCtrPercent),
        previousValue: prevCtrPercent,
      },
      avgDuration: {
        value: avgDurationSec,
        delta: isLifetime ? null : pctDelta(avgDurationSec, prevAverageViewDuration),
        previousValue: prevAverageViewDuration,
      },
    },
    audience: {
      subscribers: {
        value: subscribersValue,
        delta: subscribersDelta,
        previousValue: previousSubscribersValue,
        gained: subscribersGained,
        lost: subscribersLost,
        absolute: channel.subscriberCount || 0,
      },
      uniqueViewers: { value: Math.round(totalViews * 0.7), delta: 0 },
      returning: { value: returningPercent, delta: 0 },
      avgViews: { value: videos.length > 0 ? Math.round(totalViews / Math.max(1, videos.length)) : 0, delta: 0 },
      likes: {
        value: totalLikes,
        delta: isLifetime ? null : pctDelta(totalLikes, prev.likes),
        lifetime: lifetime.likes,
      },
      comments: {
        value: totalComments,
        delta: isLifetime ? null : pctDelta(totalComments, prev.comments),
        lifetime: lifetime.comments,
      },
    },
  }

  const publishedPeriodVideos = periodVideos.filter(
    (video) => video?.date && startOfDay(video.date) <= asOf,
  )
  const topByViews = [...publishedPeriodVideos]
    .filter((video) => (video.periodViews || 0) > 0)
    .sort((a, b) => (b.periodViews || 0) - (a.periodViews || 0))
    .slice(0, 10)
  const recentVideos = [...publishedPeriodVideos]
    .sort((a, b) => toCalendarDate(b.date) - toCalendarDate(a.date))
    .slice(0, 10)
  const newest = recentVideos[0] || null
  const formatShares = buildFormatShares(publishedPeriodVideos)

  return {
    range,
    channel,
    lifetime,
    overview: {
      kpis: kpis.overview,
      series,
      recentVideos,
      topVideos: topByViews,
      newest,
    },
    content: {
      allVideos: publishedPeriodVideos,
      kpis: kpis.content,
      series,
      seriesByType,
      metricSeries: contentMetricSeries,
      metricSeriesByType: contentMetricSeriesByType,
      kpisByType: contentKpisByType,
      subscribers,
      subscribersByType,
      traffic,
      trafficByType,
      ctrByType,
      topVideos: topByViews.slice(0, 5),
      impressionsTotal: impressions,
    },
    audience: {
      kpis: kpis.audience,
      monthlyViewers,
      monthlyViewersSeries,
      subscribers,
      newReturning,
      heatmap,
      ageGender,
      devices,
      geography,
      languages,
      formatShares,
    },
    retention: {
      channel: channelRetention,
      videos: retentionVideos,
    },
    realtime,
    monetization,
  }
}

function buildFormatShares(videos) {
  const totals = {
    video: 0,
    short: 0,
    live: 0,
  }
  for (const video of videos) {
    const type = resolveVideoType(video)
    totals[type] += Math.max(0, Number(video.periodViews ?? video.views) || 0)
  }
  const max = Math.max(1, totals.video, totals.short, totals.live)
  return [
    { key: 'video', label: 'Видео', score: totals.video / max },
    { key: 'short', label: 'Shorts', score: totals.short / max },
    { key: 'live', label: 'Трансляции', score: totals.live / max },
  ]
}

/* === realtime: 48 баров (1 бар = 1 час), последний — «сейчас» === */
function buildRealtime(seed, totalViews, days) {
  const bars = 48
  const safeTotalViews = Math.max(0, Number(totalViews) || 0)
  if (safeTotalViews === 0) {
    return {
      last48: new Array(bars).fill(0),
      currentViewers: 0,
      totalLastHour: 0,
      hourlyBase: 0,
      generatorSeed: seed,
    }
  }
  const rawShape = generateDailyShape({ seed, days: bars, profile: 'seasonal', startWeekday: 0 })
  const baseDailyViews = safeTotalViews / Math.max(1, days)
  const hourlyBase = baseDailyViews / 24
  const weightedShape = rawShape.map((x, i) => {
    const wave = 1 + Math.sin((i / 48) * Math.PI * 4) * 0.24
    const seeded = 0.72 + (((seed + i * 37) % 100) / 100) * 0.62
    return Math.max(0, x * wave * seeded)
  })
  const targetTotal = Math.max(1, Math.round(hourlyBase * bars))
  const last48 = distributeDiscreteTotal(
    normalizeToTotal(weightedShape, targetTotal),
    targetTotal,
  )
  const currentViewers = Math.max(0, Math.round(last48[last48.length - 1] / 60))
  const totalLastHour = last48[last48.length - 1]
  return { last48, currentViewers, totalLastHour, hourlyBase, generatorSeed: seed }
}

/* === monetization === */
function buildMonetization({
  channel,
  channelSeed,
  series,
  sixMonthSeries,
  sixMonthSeriesByType,
  totalRevenue,
  totalViews,
  prev,
  isLifetime,
}) {
  const enabled = channel.monetizationEnabled !== false
  if (!enabled) {
    return {
      enabled: false,
      kpis: {
        revenue: { value: 0, delta: 0 },
        monetizedPlaybacks: { value: 0, delta: 0 },
        adImpressions: { value: 0, delta: 0 },
      },
      series: series.map((d) => ({ ...d, revenue: 0 })),
      sixMonthSeries: sixMonthSeries.map((d) => ({ ...d, revenue: 0 })),
      sixMonthSeriesByType: Object.fromEntries(
        Object.entries(sixMonthSeriesByType).map(([key, rows]) => [
          key,
          rows.map((row) => ({ ...row, revenue: 0 })),
        ]),
      ),
      sources: [],
      stackedSeries: [],
      sixMonthStackedSeries: [],
    }
  }
  const monetizedPct = 0.78 + ((channelSeed % 100) / 100) * 0.12
  const monetizedPlaybacks = Math.round(totalViews * monetizedPct)
  const adImpressions = Math.round(monetizedPlaybacks * (1.2 + ((channelSeed % 50) / 50) * 0.6))

  const sources = [
    { key: 'ads', label: 'Реклама', share: 0.78 + ((channelSeed % 50) / 50) * 0.06 },
    { key: 'premium', label: 'YouTube Premium', share: 0.09 + ((channelSeed % 30) / 30) * 0.04 },
    { key: 'memberships', label: 'Спонсорства', share: 0.04 + ((channelSeed % 20) / 20) * 0.03 },
    { key: 'supers', label: 'Supers / Чаты', share: 0.02 + ((channelSeed % 10) / 10) * 0.02 },
    { key: 'shopping', label: 'Покупки и товары', share: 0.01 + ((channelSeed % 7) / 7) * 0.015 },
  ]
  const sumS = sources.reduce((s, x) => s + x.share, 0)
  sources.forEach((s) => { s.share /= sumS })
  const sourcesWithAmount = sources.map((s) => ({ ...s, value: +(totalRevenue * s.share).toFixed(2) }))

  const stackedSeries = series.map((d) => {
    const row = { date: d.date, weekday: d.weekday }
    for (const src of sourcesWithAmount) {
      row[src.key] = +(d.revenue * src.share).toFixed(2)
    }
    return row
  })
  const sixMonthStackedSeries = sixMonthSeries.map((d) => {
    const row = { date: d.date, weekday: d.weekday }
    for (const src of sourcesWithAmount) {
      row[src.key] = +(d.revenue * src.share).toFixed(2)
    }
    return row
  })

  return {
    enabled: true,
    kpis: {
      revenue: {
        value: totalRevenue,
        delta: isLifetime ? null : pctDelta(totalRevenue, prev.revenue),
      },
      monetizedPlaybacks: { value: monetizedPlaybacks, delta: 0 },
      adImpressions: { value: adImpressions, delta: 0 },
    },
    series,
    sixMonthSeries,
    sixMonthSeriesByType,
    sources: sourcesWithAmount,
    stackedSeries,
    sixMonthStackedSeries,
  }
}

export { parseDuration }
