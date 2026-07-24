import {
  estimateLifetimeRevenue,
  estimateLifetimeViews,
  getVideoAgeDays,
  hashSeed,
  inferProfile,
  seededRng,
} from '../lib/analyticsEngine.js'

const RU_TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo',
  ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

const RANDOM_WORDS_A = [
  'Быстрый', 'Подробный', 'Практичный', 'Закрытый', 'Утренний',
  'Вечерний', 'Профи', 'Рыночный', 'Чистый', 'Рабочий',
]
const RANDOM_WORDS_B = [
  'разбор сделки', 'план входа', 'обзор рынка', 'дневник трейдера',
  'риск-план', 'сетап дня', 'разбор фьючерсов', 'доход от трейдинга',
  'скальпинг', 'анализ графика',
]
const RANDOM_WORDS_C = [
  '2026', 'за 5 минут', 'без эмоций', 'live', 'гайд',
  'для новичков', 'по BTC', 'по акциям', 'по фьючерсам', 'с результатом',
]

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function parseNonNegativeInteger(value) {
  if (value === '' || value == null) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function parseNonNegativeMoney(value) {
  if (value === '' || value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null
}

function seedForVideo({ id, title, date, duration } = {}) {
  return hashSeed(id || '', title || 'video', date || todayISO(), duration || '')
}

function normalizeType(type, duration) {
  if (['video', 'short', 'live'].includes(type)) return type
  const parts = String(duration || '').split(':').map((part) => Number.parseInt(part, 10) || 0)
  const seconds = parts.length === 2
    ? parts[0] * 60 + parts[1]
    : parts.length === 3
      ? parts[0] * 3600 + parts[1] * 60 + parts[2]
      : 0
  return seconds > 0 && seconds <= 60 ? 'short' : 'video'
}

function pickProfileFromSeed(seed, ageDays) {
  const random = seededRng(seed)
  if (ageDays < 4) return random() > 0.8 ? 'viralSpike' : 'gradualGrowth'
  if (ageDays > 180) return random() > 0.72 ? 'steady' : 'decayAfterPeak'
  if (random() > 0.88) return 'viralSpike'
  if (random() > 0.72) return 'seasonal'
  if (random() > 0.56) return 'steady'
  return 'gradualGrowth'
}

export function transliterate(value) {
  return String(value)
    .toLowerCase()
    .split('')
    .map((character) => RU_TRANSLIT[character] ?? character)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export function makeId(title) {
  const base = transliterate(title) || 'video'
  return `${base}-${Date.now().toString(36)}`
}

export function rand(min, max) {
  return Math.random() * (max - min) + min
}

export function randInt(min, max) {
  return Math.floor(rand(min, max + 1))
}

export function computeMetrics(views, seed = Math.random()) {
  const likeRate = 0.03 + (seed % 0.04)
  const likes = Math.max(0, Math.round(views * likeRate))
  const dislikeRate = 0.10 + ((seed * 7.13) % 0.20)
  const dislikes = Math.max(0, Math.round(likes * dislikeRate))
  const total = likes + dislikes
  return {
    likes,
    dislikes,
    likePct: total === 0 ? null : likes / total,
  }
}

export function formatViews(value) {
  if (value == null) return '—'
  const nbsp = '\u00a0'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')}${nbsp}млн`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace('.', ',')}${nbsp}тыс.`
  return String(value)
}

export function formatNumber(value) {
  if (value == null) return '—'
  return new Intl.NumberFormat('ru-RU').format(value)
}

export function formatMoney(value) {
  if (value == null) return '—'
  return `${new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} $`
}

export function formatDate(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  const months = [
    'янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.',
    'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.',
  ]
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()} г.`
}

export function formatLikePct(value) {
  if (value == null) return '—'
  return `${(value * 100).toFixed(1).replace('.', ',')} %`
}

export function randomTitle() {
  return [
    RANDOM_WORDS_A[randInt(0, RANDOM_WORDS_A.length - 1)],
    RANDOM_WORDS_B[randInt(0, RANDOM_WORDS_B.length - 1)],
    RANDOM_WORDS_C[randInt(0, RANDOM_WORDS_C.length - 1)],
  ].join(' ')
}

export function generateVideoStats({
  id,
  title,
  date,
  duration,
  seed,
  today = new Date(),
} = {}) {
  const publishedAt = date || todayISO()
  const ageDays = getVideoAgeDays(publishedAt, today)
  const baseSeed = seed || seedForVideo({ id, title, date: publishedAt, duration })
  const profile = pickProfileFromSeed(baseSeed, ageDays)
  const views = estimateLifetimeViews({ seed: baseSeed, ageDays, profile })
  const revenue = estimateLifetimeRevenue({
    views,
    seed: hashSeed(baseSeed, 'revenue'),
    ageDays,
  })
  return {
    views,
    revenue,
    ...computeMetrics(views, (baseSeed % 10000) / 10000),
    profile,
    ageDays,
  }
}

export function randomViews(options = {}) {
  if (options && typeof options === 'object') return generateVideoStats(options).views
  return generateVideoStats({ date: todayISO(), seed: hashSeed(Date.now(), Math.random()) }).views
}

export function suggestRevenue(input) {
  if (input && typeof input === 'object') {
    const views = parseNonNegativeInteger(input.views) ?? 0
    const date = input.date || todayISO()
    const seed = input.seed || seedForVideo(input)
    return estimateLifetimeRevenue({
      views,
      seed: hashSeed(seed, 'revenue'),
      ageDays: getVideoAgeDays(date, input.today || new Date()),
    })
  }
  const views = parseNonNegativeInteger(input) ?? 0
  return estimateLifetimeRevenue({
    views,
    seed: hashSeed(views, Date.now(), Math.random()),
    ageDays: getVideoAgeDays(todayISO()),
  })
}

export function randomDuration() {
  const minutes = randInt(0, 14)
  const seconds = randInt(1, 59)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function normalizeVideo(input = {}, options = {}) {
  const base = options.base || null
  const id = input.id || base?.id || makeId(input.title || base?.title || 'video')
  const title = input.title || base?.title || 'Без названия'
  const date = input.date || base?.date || todayISO()
  const duration = input.duration || base?.duration || randomDuration()
  const type = normalizeType(input.type ?? base?.type, duration)
  const seed = seedForVideo({ id, title, date, duration })
  const generated = generateVideoStats({ id, title, date, duration, seed })

  const inputViews = parseNonNegativeInteger(input.views)
  const baseViews = parseNonNegativeInteger(base?.views)
  const dateLikeChanged = input.date !== undefined || input.title !== undefined || input.duration !== undefined
  const forceAutoViews = input.autoViews === true
  const baseAutoViews = base?._autoStats?.views === true
  const shouldGenerateViews = forceAutoViews || (
    inputViews === null && (!base || baseViews === null || (baseAutoViews && dateLikeChanged))
  )
  const views = shouldGenerateViews ? generated.views : (inputViews ?? baseViews ?? generated.views)

  const inputRevenue = parseNonNegativeMoney(input.revenue)
  const baseRevenue = parseNonNegativeMoney(base?.revenue)
  const forceAutoRevenue = input.autoRevenue === true
  const baseAutoRevenue = base?._autoStats?.revenue === true
  const generatedRevenue = estimateLifetimeRevenue({
    views,
    seed: hashSeed(seed, 'revenue'),
    ageDays: getVideoAgeDays(date),
  })
  const shouldGenerateRevenue = forceAutoRevenue || (
    inputRevenue === null
    && (!base || baseRevenue === null || (baseAutoRevenue && (dateLikeChanged || views !== baseViews)))
  )
  const revenue = shouldGenerateRevenue ? generatedRevenue : (inputRevenue ?? baseRevenue ?? generatedRevenue)

  const metrics = computeMetrics(views, (seed % 10000) / 10000)
  const metricsNeedRefresh = !base || views !== baseViews || input.autoViews === true
  const likes = metricsNeedRefresh
    ? (parseNonNegativeInteger(input.likes) ?? metrics.likes)
    : (parseNonNegativeInteger(input.likes) ?? parseNonNegativeInteger(base?.likes) ?? metrics.likes)
  const dislikes = metricsNeedRefresh
    ? (parseNonNegativeInteger(input.dislikes) ?? metrics.dislikes)
    : (parseNonNegativeInteger(input.dislikes) ?? parseNonNegativeInteger(base?.dislikes) ?? metrics.dislikes)

  return {
    id,
    title,
    cover: input.cover !== undefined ? input.cover : (base?.cover || null),
    coverPath: input.coverPath !== undefined ? input.coverPath : (base?.coverPath || null),
    date,
    duration,
    type,
    views,
    likes,
    dislikes,
    likePct: likes + dislikes === 0 ? null : likes / (likes + dislikes),
    revenue,
    profile: input.profile || base?.profile || generated.profile || inferProfile({
      ...base,
      ...input,
      views,
      date,
    }),
    _autoStats: {
      views: shouldGenerateViews || (baseAutoViews && inputViews === null),
      revenue: shouldGenerateRevenue || (baseAutoRevenue && inputRevenue === null),
    },
    createdAt: input.createdAt || base?.createdAt || Date.now(),
  }
}
