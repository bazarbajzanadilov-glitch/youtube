/**
 * localStorage-based store for fake YouTube Studio data.
 * Все видео хранятся в одной записи `yt-studio-videos` (массив).
 * Лайки/дизлайки/проценты — вычисляются автоматически из просмотров.
 */

const STORAGE_KEY = 'yt-studio-videos'
const STORAGE_EVENT = 'yt-studio-store-update'
const BOOTSTRAP_FLAG = 'yt-studio-videos-bootstrapped'
const BOOTSTRAP_URL = './data/videos.json'

/**
 * Хранилище видео:
 * 1. Источник истины при первом запуске — `public/data/videos.json`
 *    (этот файл бандлится статически и НЕ удаляется при обновлении кода).
 * 2. После первого старта данные живут в localStorage и редактируются админкой.
 * 3. В админке есть «Экспорт JSON» — скачивает videos.json для коммита в репо.
 *    «Сбросить к коду» — очищает localStorage и перечитывает файл.
 */

/* === Утилиты === */

const RU_TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo',
  ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

export function transliterate(s) {
  return String(s)
    .toLowerCase()
    .split('')
    .map((ch) => RU_TRANSLIT[ch] ?? ch)
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

/* === Авто-расчёт метрик === */

export function computeMetrics(views, seed = Math.random()) {
  // Лайки = 3-7% от просмотров
  const likeRate = 0.03 + (seed % 0.04)
  const likes = Math.max(0, Math.round(views * likeRate))
  // Дизлайки = 10-30% от лайков
  const dislikeRate = 0.10 + ((seed * 7.13) % 0.20)
  const dislikes = Math.max(0, Math.round(likes * dislikeRate))
  const total = likes + dislikes
  const likePct = total === 0 ? null : likes / total
  return { likes, dislikes, likePct }
}

export function formatViews(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.', ',') + ' млн'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.', ',') + ' тыс.'
  return String(n)
}

export function formatNumber(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('ru-RU').format(n)
}

export function formatMoney(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' $'
}

export function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const m = ['янв.','февр.','мар.','апр.','мая','июн.','июл.','авг.','сент.','окт.','нояб.','дек.'][d.getMonth()]
  return `${d.getDate()} ${m} ${d.getFullYear()} г.`
}

export function formatLikePct(p) {
  if (p == null) return '—'
  return (p * 100).toFixed(1).replace('.', ',') + ' %'
}

/* === Имя по дате/времени для random fill === */

const RANDOM_WORDS_A = ['Эпическая','Лучшая','Невероятная','Полная','Скрытая','Удивительная','Топовая','Секретная','Профи','Быстрая']
const RANDOM_WORDS_B = ['подборка','версия','история','тренировка','распаковка','подкаст','хроника','обзор','реакция','сборка']
const RANDOM_WORDS_C = ['2026','за 5 минут','без купюр','ASMR','live','OST','tier list','гайд','для новичков','финал']

export function randomTitle() {
  return `${RANDOM_WORDS_A[randInt(0, RANDOM_WORDS_A.length - 1)]} ${RANDOM_WORDS_B[randInt(0, RANDOM_WORDS_B.length - 1)]} ${RANDOM_WORDS_C[randInt(0, RANDOM_WORDS_C.length - 1)]}`
}

export function randomViews() { return randInt(1_000, 500_000) }

export function suggestRevenue(views) {
  // Реалистичная фейк-логика: $2-5 за 1000 просмотров (RPM)
  const rpm = rand(2, 5)
  return Math.round(views * rpm / 1000 * 100) / 100
}

export function randomDuration() {
  const m = randInt(0, 14)
  const sec = randInt(1, 59)
  return `${m}:${sec < 10 ? '0' + sec : sec}`
}

/* === Низкоуровневое хранилище === */

/* Кэш snapshot — обязательно для useSyncExternalStore. */
let videosCache = null
let totalsCache = null

function invalidateCache() {
  videosCache = null
  totalsCache = null
}

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function write(videos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(videos))
  invalidateCache()
  // Уведомляем все компоненты
  window.dispatchEvent(new CustomEvent(STORAGE_EVENT))
}

/* === Публичный API === */

export function getVideos() {
  if (videosCache === null) {
    videosCache = read().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }
  return videosCache
}

export function addVideo(input) {
  const id = makeId(input.title || 'video')
  const views = input.views ?? randomViews()
  const { likes, dislikes, likePct } = computeMetrics(views, Math.random())
  const revenue = input.revenue ?? suggestRevenue(views)
  const video = {
    id,
    title: input.title || 'Без названия',
    cover: input.cover || null,
    date: input.date || new Date().toISOString().slice(0, 10),
    duration: input.duration || randomDuration(),
    views,
    likes,
    dislikes,
    likePct,
    revenue,
    createdAt: Date.now(),
  }
  const all = read()
  all.push(video)
  write(all)
  return video
}

export function updateVideo(id, patch) {
  const all = read()
  const idx = all.findIndex((v) => v.id === id)
  if (idx < 0) return null
  const merged = { ...all[idx], ...patch }
  // Если изменились views — пересчитать likes/dislikes
  if (patch.views !== undefined && patch.views !== all[idx].views) {
    const m = computeMetrics(merged.views, Math.random())
    merged.likes = m.likes
    merged.dislikes = m.dislikes
    merged.likePct = m.likePct
  }
  // Если revenue не задан и views поменялся — пересчитать
  if (patch.revenue === undefined && patch.views !== undefined && patch.views !== all[idx].views) {
    merged.revenue = suggestRevenue(merged.views)
  }
  all[idx] = merged
  write(all)
  return merged
}

export function removeVideo(id) {
  const all = read().filter((v) => v.id !== id)
  write(all)
}

export function clearAllVideos() {
  write([])
}

export function importVideos(arr) {
  if (!Array.isArray(arr)) return
  const sanitized = arr
    .filter((v) => v && typeof v === 'object')
    .map((v) => {
      const views = Math.max(0, parseInt(v.views, 10) || 0)
      const m = computeMetrics(views, Math.random())
      return {
        id: v.id || makeId(v.title || 'video'),
        title: v.title || 'Без названия',
        cover: v.cover || null,
        date: v.date || new Date().toISOString().slice(0, 10),
        duration: v.duration || randomDuration(),
        views,
        likes: Number.isFinite(v.likes) ? v.likes : m.likes,
        dislikes: Number.isFinite(v.dislikes) ? v.dislikes : m.dislikes,
        likePct: Number.isFinite(v.likePct) ? v.likePct : m.likePct,
        revenue: Number.isFinite(v.revenue) ? v.revenue : suggestRevenue(views),
        createdAt: v.createdAt || Date.now(),
      }
    })
  write(sanitized)
}

export function removeMany(ids) {
  const set = new Set(ids)
  const all = read().filter((v) => !set.has(v.id))
  write(all)
}

export function bulkAddRandom(count) {
  const all = read()
  for (let i = 0; i < count; i++) {
    const views = randomViews()
    const { likes, dislikes, likePct } = computeMetrics(views, Math.random())
    const title = randomTitle()
    all.push({
      id: makeId(title),
      title,
      cover: null,
      date: new Date(Date.now() - randInt(0, 365) * 86400000).toISOString().slice(0, 10),
      duration: randomDuration(),
      views,
      likes,
      dislikes,
      likePct,
      revenue: suggestRevenue(views),
      createdAt: Date.now() + i,
    })
  }
  write(all)
}

export async function bootstrapFromFile() {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(BOOTSTRAP_FLAG)) return
  if (localStorage.getItem(STORAGE_KEY)) {
    localStorage.setItem(BOOTSTRAP_FLAG, '1')
    return
  }
  try {
    const url = new URL(BOOTSTRAP_URL, document.baseURI).toString()
    const res = await fetch(url, { cache: 'no-cache' })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        importVideos(data)
      }
    }
  } catch {
    // ignore — start with empty list
  }
  localStorage.setItem(BOOTSTRAP_FLAG, '1')
}

export async function resetToBundled() {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(BOOTSTRAP_FLAG)
  invalidateCache()
  window.dispatchEvent(new CustomEvent(STORAGE_EVENT))
  await bootstrapFromFile()
  window.dispatchEvent(new CustomEvent(STORAGE_EVENT))
}

export function exportToFile() {
  const data = JSON.stringify(read(), null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'videos.json'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* === Aggregates === */

export function getTotals() {
  if (totalsCache === null) {
    const videos = getVideos()
    totalsCache = {
      count: videos.length,
      views: videos.reduce((s, v) => s + (v.views || 0), 0),
      likes: videos.reduce((s, v) => s + (v.likes || 0), 0),
      dislikes: videos.reduce((s, v) => s + (v.dislikes || 0), 0),
      revenue: videos.reduce((s, v) => s + (v.revenue || 0), 0),
    }
  }
  return totalsCache
}

/* === Subscriber API for the React hook === */

export function subscribe(listener) {
  const onCustom = () => listener()
  const onStorage = (e) => {
    if (e.key === STORAGE_KEY) {
      invalidateCache()
      listener()
    }
  }
  window.addEventListener(STORAGE_EVENT, onCustom)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(STORAGE_EVENT, onCustom)
    window.removeEventListener('storage', onStorage)
  }
}
