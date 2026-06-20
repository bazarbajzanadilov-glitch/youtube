/**
 * Канал-уровневый агрегатор. Принимает videos[] + channel + range,
 * возвращает структуру со всеми сериями для экранов аналитики/монетизации.
 *
 * Подход: каждое видео получает свою дневную форму (engine.generateDailyShape)
 * на интервале от publishDate до today, нормированную в video.views. Серии
 * суммируются по календарным дням → канальная серия. Это даёт «живое»
 * поведение: правка views в админке немедленно меняет график; новое видео
 * — естественный всплеск в дате публикации.
 */

import {
  hashSeed, isoDay, addDays, daysBetween, startOfDay,
  generateDailyShape, generateLifecycleShape, normalizeToTotal, inferProfile,
  generateRetention, generateHourlyHeatmap,
  generateTrafficShares, generateDeviceShares, generateGeoShares,
  generateAgeGender, generateLanguageShares, generateReturningSeries,
} from './analyticsEngine.js'

/* === range resolver === */

export const RANGE_OPTIONS = [
  { kind: '7d', label: 'Последние 7 дней', days: 7 },
  { kind: '28d', label: 'Последние 28 дней', days: 28 },
  { kind: '90d', label: 'Последние 90 дней', days: 90 },
  { kind: '365d', label: 'Последние 365 дней', days: 365 },
  { kind: 'lifetime', label: 'Все время', days: null },
  { kind: 'custom', label: 'Другой диапазон дат', days: null },
]

export function resolveRange(range, videos, today = new Date()) {
  const todayD = startOfDay(today)
  const yearMatch = /^year-(\d{4})$/.exec(range?.kind || '')
  if (yearMatch) {
    const year = Number(yearMatch[1])
    const from = startOfDay(new Date(year, 0, 1))
    const end = startOfDay(new Date(year, 11, 31))
    const to = end > todayD && from <= todayD ? todayD : end
    const days = Math.max(1, daysBetween(from, to) + 1)
    return { from, to, days, kind: range.kind, label: String(year) }
  }
  const monthMatch = /^month-(\d{4})-(\d{2})$/.exec(range?.kind || '')
  if (monthMatch) {
    const year = Number(monthMatch[1])
    const month = Number(monthMatch[2]) - 1
    const from = startOfDay(new Date(year, month, 1))
    const end = startOfDay(new Date(year, month + 1, 0))
    const to = end > todayD && from <= todayD ? todayD : end
    const days = Math.max(1, daysBetween(from, to) + 1)
    return { from, to, days, kind: range.kind, label: range.label || `${year}-${monthMatch[2]}` }
  }
  if (range?.kind === 'custom' && range.from && range.to) {
    const from = startOfDay(new Date(range.from))
    const to = startOfDay(new Date(range.to))
    const days = Math.max(1, daysBetween(from, to) + 1)
    return { from, to, days, kind: 'custom', label: 'Свой диапазон' }
  }
  if (range?.kind === 'lifetime') {
    let earliest = todayD
    for (const v of videos) {
      if (v.date) {
        const d = startOfDay(new Date(v.date))
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
    map.set(key, { date: key, views: 0, watchTime: 0, revenue: 0, likes: 0, comments: 0, weekday: d.getDay() })
  }
  return { dates, map }
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

function attachVideoContribution({ video, channel, range, dayMap }) {
  if (!video || !video.date) return
  const today = range.to
  const publish = startOfDay(new Date(video.date))
  if (publish > today) return
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
  const scaled = normalizeToTotal(shape, totalViews)
  const totalRevenue = effectiveRevenue(video, channel)
  const revenueSeed = hashSeed(channel.channelName, video.id, 'revenue', totalRevenue)
  const revenueRand = seededRevenue(revenueSeed)
  const revenueShape = scaled.map((x, i) => {
    const ageBoost = i < 3 ? 0.82 + i * 0.08 : 1
    return x * ageBoost * (0.85 + revenueRand() * 0.35)
  })
  const revenueScaled = totalViews > 0 && totalRevenue > 0
    ? normalizeToTotal(revenueShape, totalRevenue)
    : new Array(scaled.length).fill(0)
  const totalLikes = Math.max(0, Number(video.likes) || 0)
  const likesScaled = totalViews > 0 && totalLikes > 0
    ? scaled.map((x) => (x / totalViews) * totalLikes)
    : new Array(scaled.length).fill(0)
  const totalComments = effectiveComments(video)
  const commentsScaled = totalViews > 0 && totalComments > 0
    ? scaled.map((x) => (x / totalViews) * totalComments)
    : new Array(scaled.length).fill(0)
  const durationSec = parseDuration(video.duration)
  const watchEachSec = scaled.map((views) => views * durationSec * 0.45)
  for (let i = 0; i < ageDays; i += 1) {
    const day = addDays(publish, i)
    const key = isoDay(day)
    const slot = dayMap.get(key)
    if (slot) {
      slot.views += scaled[i]
      slot.revenue += revenueScaled[i]
      slot.watchTime += watchEachSec[i]
      slot.likes += likesScaled[i]
      slot.comments += commentsScaled[i]
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

function buildPrevSeries(videos, channel, range) {
  const prevTo = addDays(range.from, -1)
  const prevFrom = addDays(prevTo, -(range.days - 1))
  const { map } = buildDailyMap(prevFrom, range.days)
  videos.forEach((v) => attachVideoContribution({
    video: v,
    channel,
    range: { from: prevFrom, to: prevTo, days: range.days },
    dayMap: map,
  }))
  let views = 0
  let watch = 0
  let revenue = 0
  let likes = 0
  let comments = 0
  for (const x of map.values()) {
    views += x.views
    watch += x.watchTime
    revenue += x.revenue
    likes += x.likes
    comments += x.comments
  }
  return { views, watch, revenue, likes, comments }
}

function pctDelta(curr, prev) {
  if (!prev) return curr > 0 ? 100 : 0
  const raw = ((curr - prev) / prev) * 100
  /* Всегда показываем рост: отрицательную дельту инвертируем в положительную,
     так у пользователя в KPI-чипе всегда «обычное значение» с зелёным «+». */
  return Math.abs(raw)
}

function bucketKey(dateIso, granularity) {
  const d = new Date(dateIso)
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

function downsampleSubscribers(daily, granularity) {
  if (daily.length === 0) return daily
  const buckets = new Map()
  for (const row of daily) {
    const key = bucketKey(row.date, granularity)
    /* для подписчиков берём последнее значение бакета — кумулятивная метрика */
    buckets.set(key, { date: key, subscribers: row.subscribers })
  }
  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date))
}

function bucketSeries(series, granularity) {
  if (granularity === 'day' || series.length === 0) return series
  const buckets = new Map()
  for (const row of series) {
    const key = bucketKey(row.date, granularity)
    if (!buckets.has(key)) {
      buckets.set(key, { date: key, weekday: 0, views: 0, watchTime: 0, revenue: 0, likes: 0, comments: 0 })
    }
    const b = buckets.get(key)
    b.views += row.views
    b.watchTime += row.watchTime
    b.revenue += row.revenue
    b.likes += row.likes
    b.comments += row.comments
  }
  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date)).map((b) => ({
    ...b,
    revenue: +b.revenue.toFixed(2),
  }))
}

function buildSeriesForVideos(videos, channel, range, granularity) {
  const { dates, map } = buildDailyMap(range.from, range.days)
  videos.forEach((video) => attachVideoContribution({ video, channel, range, dayMap: map }))
  const dailySeries = dates.map(({ date, weekday }) => {
    const slot = map.get(date)
    return {
      date,
      weekday,
      views: +slot.views.toFixed(3),
      watchTime: +slot.watchTime.toFixed(3),
      revenue: +slot.revenue.toFixed(2),
      likes: +slot.likes.toFixed(3),
      comments: +slot.comments.toFixed(3),
    }
  })
  return bucketSeries(dailySeries, granularity)
}

/**
 * Lifetime итоги — это «правда» канала. Они должны совпадать с Dashboard
 * (Screen1Dashboard) — иначе видна десинхронизация. При range='lifetime'
 * период-серия равна lifetime; для других range — выводятся как hint.
 */
function computeLifetime(videos, channel) {
  let views = 0
  let likes = 0
  let revenue = 0
  let comments = 0
  let watchSec = 0
  for (const v of videos) {
    const vv = Math.max(0, Number(v.views) || 0)
    views += vv
    likes += Math.max(0, Number(v.likes) || 0)
    revenue += effectiveRevenue(v, channel)
    comments += effectiveComments(v)
    watchSec += vv * parseDuration(v.duration) * 0.45
  }
  return {
    views,
    likes,
    revenue: +revenue.toFixed(2),
    comments,
    watchHours: watchSec / 3600,
    videos: videos.length,
  }
}

/* === main builder === */

export function build(videosInput, channelInput, rangeInput, options = {}) {
  const videos = Array.isArray(videosInput) ? videosInput : []
  const channel = channelInput || {}
  const today = options.today || new Date()
  const range = resolveRange(rangeInput, videos, today)
  const channelSeed = hashSeed(channel.channelName || 'channel', channel.country || 'RU', range.kind)

  const lifetime = computeLifetime(videos, channel)
  const { dates, map } = buildDailyMap(range.from, range.days)
  videos.forEach((v) => attachVideoContribution({ video: v, channel, range, dayMap: map }))

  /* Сырые слоты + 3-дневное скользящее среднее для канальной серии — убирает
     single-day всплески. Сумма сохраняется через rescale. */
  const rawViews = dates.map(({ date }) => map.get(date).views)
  const rawWatch = dates.map(({ date }) => map.get(date).watchTime)
  const rawRev = dates.map(({ date }) => map.get(date).revenue)
  const rawLikes = dates.map(({ date }) => map.get(date).likes)
  const rawComm = dates.map(({ date }) => map.get(date).comments)

  /* Без скользящего среднего: оставляем дневные колебания, чтобы линейный
     график имел естественные «острые» пики, как в реальном YouTube Studio. */
  const smoothedViews = rawViews
  const smoothedWatch = rawWatch
  const smoothedRev = rawRev
  const smoothedLikes = rawLikes
  const smoothedComm = rawComm

  const dailySeries = dates.map(({ date, weekday }, i) => ({
    date,
    weekday,
    views: Math.round(smoothedViews[i]),
    watchTime: Math.round(smoothedWatch[i]),
    revenue: +smoothedRev[i].toFixed(2),
    likes: Math.round(smoothedLikes[i]),
    comments: Math.round(smoothedComm[i]),
  }))
  /* Бакетинг: для длинных диапазонов аггрегируем по неделям/месяцам, чтобы чарт был
     читаемым (а не плоской линией с одним всплеском в конце). */
  const granularity = range.days <= 56 ? 'day' : range.days <= 240 ? 'week' : 'month'
  const series = bucketSeries(dailySeries, granularity)

  // Если range = lifetime — period totals привязываем к lifetime totals (точное совпадение с Dashboard)
  const isLifetime = range.kind === 'lifetime'
  const totalViewsRaw = series.reduce((s, x) => s + x.views, 0)
  const totalLikesRaw = series.reduce((s, x) => s + x.likes, 0)
  const totalCommentsRaw = series.reduce((s, x) => s + x.comments, 0)
  const totalWatchSec = series.reduce((s, x) => s + x.watchTime, 0)
  const totalRevenueRaw = series.reduce((s, x) => s + x.revenue, 0)

  const totalViews = isLifetime ? lifetime.views : totalViewsRaw
  const totalLikes = isLifetime ? lifetime.likes : totalLikesRaw
  const totalComments = isLifetime ? lifetime.comments : totalCommentsRaw
  const totalRevenue = isLifetime ? lifetime.revenue : totalRevenueRaw
  const totalWatchHours = isLifetime ? lifetime.watchHours : totalWatchSec / 3600

  const allViewsForDuration = videos.reduce((s, v) => s + (v.views || 0), 0)
  const allWatchSec = videos.reduce((s, v) => s + (v.views || 0) * parseDuration(v.duration) * 0.45, 0)
  const avgDurationSec = allViewsForDuration > 0 ? allWatchSec / allViewsForDuration : 0

  const videosByType = {
    video: videos.filter((video) => resolveVideoType(video) === 'video'),
    short: videos.filter((video) => resolveVideoType(video) === 'short'),
    live: videos.filter((video) => resolveVideoType(video) === 'live'),
  }
  const seriesByType = {
    video: buildSeriesForVideos(videosByType.video, channel, range, granularity),
    short: buildSeriesForVideos(videosByType.short, channel, range, granularity),
    live: buildSeriesForVideos(videosByType.live, channel, range, granularity),
  }

  const prev = buildPrevSeries(videos, channel, range)
  const prevWatchHours = prev.watch / 3600
  const subscribersDaily = buildSubscriberSeries(channel, channelSeed, dates)
  /* Для подписчиков делаем downsampling (последняя точка каждого бакета — это
     текущее число подписчиков на конец недели/месяца). */
  const subscribers = granularity === 'day'
    ? subscribersDaily
    : downsampleSubscribers(subscribersDaily, granularity)
  const subscribersDelta = subscribers.length > 0
    ? subscribers[subscribers.length - 1].subscribers - subscribers[0].subscribers
    : 0

  const traffic = generateTrafficShares(channelSeed)
  const devices = generateDeviceShares(channelSeed + 1)
  const geography = generateGeoShares(channelSeed + 2, channel.country || 'RU')
  const ageGender = generateAgeGender(channelSeed + 3)
  const languages = generateLanguageShares(channelSeed + 4)
  const heatmap = generateHourlyHeatmap(channelSeed + 5)
  const returningRaw = generateReturningSeries(channelSeed + 6, range.days, range.from.getDay())
  const newReturning = series.map((d, i) => {
    const ratio = returningRaw[i]?.newRatio ?? 0.6
    const newV = Math.round(d.views * ratio)
    return { date: d.date, new: newV, returning: Math.max(0, d.views - newV) }
  })

  const ctr = 0.082 + ((channelSeed % 1000) / 1000) * 0.06
  const impressions = Math.round(totalViews / Math.max(0.04, ctr))

  const retentionVideos = videos.slice(0, 6).map((v) => ({
    videoId: v.id,
    title: v.title,
    curve: generateRetention(hashSeed(v.id, 'retention')),
  }))
  const channelRetention = generateRetention(channelSeed + 7)

  /* realtime: 48h, частица в час, последний бар = текущий */
  const realtime = buildRealtime(channelSeed + 8, totalViews, range.days)

  /* monetization split */
  const monetization = buildMonetization({
    channel, channelSeed, series, totalRevenue, totalViews, prev,
  })

  const kpis = {
    overview: {
      views: {
        value: totalViews, delta: pctDelta(totalViews, prev.views), lifetime: lifetime.views,
      },
      watchTime: {
        value: totalWatchHours, delta: pctDelta(totalWatchHours, prevWatchHours), lifetime: lifetime.watchHours,
      },
      subscribers: { value: subscribersDelta, absolute: channel.subscriberCount || 0 },
      likes: {
        value: totalLikes, delta: pctDelta(totalLikes, prev.likes), lifetime: lifetime.likes,
      },
      comments: {
        value: totalComments, delta: pctDelta(totalComments, prev.comments), lifetime: lifetime.comments,
      },
      avgDuration: { value: avgDurationSec, delta: 0 },
    },
    content: {
      views: { value: totalViews, delta: pctDelta(totalViews, prev.views), lifetime: lifetime.views },
      impressions: { value: impressions, delta: pctDelta(totalViews, prev.views) },
      ctr: { value: ctr * 100, delta: 0 },
      avgDuration: { value: avgDurationSec, delta: 0 },
    },
    audience: {
      subscribers: { value: subscribersDelta, absolute: channel.subscriberCount || 0 },
      uniqueViewers: { value: Math.round(totalViews * 0.7), delta: 0 },
      returning: { value: 100 - Math.round((returningRaw[returningRaw.length - 1]?.newRatio ?? 0.6) * 100), delta: 0 },
      avgViews: { value: videos.length > 0 ? Math.round(totalViews / Math.max(1, videos.length)) : 0, delta: 0 },
      likes: { value: totalLikes, delta: pctDelta(totalLikes, prev.likes), lifetime: lifetime.likes },
      comments: { value: totalComments, delta: pctDelta(totalComments, prev.comments), lifetime: lifetime.comments },
    },
  }

  const topByViews = [...videos].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10)
  const recentVideos = [...videos].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10)
  const newest = recentVideos[0] || null
  const formatShares = buildFormatShares(videos)

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
      allVideos: videos,
      kpis: kpis.content,
      series,
      seriesByType,
      traffic,
      topVideos: topByViews.slice(0, 5),
      impressionsTotal: impressions,
    },
    audience: {
      kpis: kpis.audience,
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
    totals[type] += Math.max(0, Number(video.views) || 0)
  }
  const max = Math.max(1, totals.video, totals.short, totals.live)
  return [
    { key: 'video', label: 'Видео', score: totals.video / max },
    { key: 'short', label: 'Shorts', score: totals.short / max },
    { key: 'live', label: 'Трансляции', score: totals.live / max },
  ]
}

/* === subscribers === */
function buildSubscriberSeries(channel, channelSeed, dates) {
  const target = Math.max(0, Number(channel.subscriberCount) || 0)
  if (target === 0 || dates.length === 0) {
    return dates.map((d) => ({ date: d.date, subscribers: 0 }))
  }
  const startFraction = 0.78 + ((channelSeed % 1000) / 1000) * 0.18
  const start = Math.round(target * Math.min(0.98, startFraction))
  const totalDelta = target - start
  const shape = generateDailyShape({
    seed: channelSeed,
    days: dates.length,
    profile: 'gradualGrowth',
    startWeekday: 0,
  })
  const sumShape = shape.reduce((s, x) => s + x, 0) || 1
  const cumulative = []
  let acc = start
  for (let i = 0; i < dates.length; i += 1) {
    const inc = (shape[i] / sumShape) * totalDelta
    acc += inc
    cumulative.push({ date: dates[i].date, subscribers: Math.round(acc) })
  }
  if (cumulative.length > 0) cumulative[cumulative.length - 1].subscribers = target
  return cumulative
}

/* === realtime: 48 баров (1 бар = 1 час), последний — «сейчас» === */
function buildRealtime(seed, totalViews, days) {
  const bars = 48
  const rawShape = generateDailyShape({ seed, days: bars, profile: 'seasonal', startWeekday: 0 })
  const baseDailyViews = totalViews / Math.max(1, days)
  const visibleDailyBase = Math.max(baseDailyViews, 240)
  const hourlyBase = visibleDailyBase / 24
  const last48 = normalizeToTotal(rawShape, hourlyBase * bars).map((x, i) => {
    const wave = 1 + Math.sin((i / 48) * Math.PI * 4) * 0.24
    const seeded = 0.72 + (((seed + i * 37) % 100) / 100) * 0.62
    return Math.max(4, Math.round(x * wave * seeded))
  })
  const currentViewers = Math.max(3, Math.round(last48[last48.length - 1] / 60 + 8))
  const totalLastHour = last48[last48.length - 1]
  return { last48, currentViewers, totalLastHour, hourlyBase, generatorSeed: seed }
}

/* === monetization === */
function buildMonetization({ channel, channelSeed, series, totalRevenue, totalViews, prev }) {
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
      sources: [],
      stackedSeries: [],
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

  return {
    enabled: true,
    kpis: {
      revenue: { value: totalRevenue, delta: pctDelta(totalRevenue, prev.revenue) },
      monetizedPlaybacks: { value: monetizedPlaybacks, delta: 0 },
      adImpressions: { value: adImpressions, delta: 0 },
    },
    series,
    sources: sourcesWithAmount,
    stackedSeries,
  }
}

export { parseDuration }
