/**
 * Канал-уровневое хранилище (зеркало videoStore.js).
 * Один объект, ключ `yt-studio-channel`. SSR-safe через ленивый снапшот.
 */

const STORAGE_KEY = 'yt-studio-channel-v3'
const STORAGE_EVENT = 'yt-studio-channel-update'

const DEFAULT_DASHBOARD_COMMENTS = [
  {
    id: 'comment-tvman',
    author: '@tvman-q2s',
    age: '4 месяца назад',
    text: 'Ты сканер я проверил код не работает',
    avatarColor: '#4a4a4a',
  },
  {
    id: 'comment-titah',
    author: '@titahhdjdjdj',
    age: '4 месяца назад',
    text: 'Я',
    avatarColor: '#6a4c33',
  },
  {
    id: 'comment-anime',
    author: '@love.anime.19',
    age: '5 месяцев назад',
    text: 'Твой код не работает:(',
    avatarColor: '#6f2727',
  },
]

const DEFAULT_RECENT_SUBSCRIBERS = [
  { id: 'sub-nurbolat', name: 'Нурболат777', count: '3,24 тыс. подписчиков', avatarColor: '#545454' },
  { id: 'sub-azizbek', name: 'az1zbek_me', count: '105 подписчиков', avatarColor: '#6e4f36' },
  { id: 'sub-football', name: 'respect football', count: '23 подписчика', avatarColor: '#6f2727' },
]

const DEFAULT_CHANNEL = {
  channelName: 'Trading1',
  country: 'KZ',
  subscriberCount: 79,
  monetizationEnabled: true,
  joinDate: '2022-01-15',
  avatar: null,
  dashboardComments: DEFAULT_DASHBOARD_COMMENTS,
  recentSubscribers: DEFAULT_RECENT_SUBSCRIBERS,
}

let cache = null

function cloneList(list) {
  return Array.isArray(list) ? list.map((item) => ({ ...item })) : []
}

const LEGACY_CHANNEL_NAMES = new Set(['rest' + 'sheets', 'rest' + 'shits'])

function normalizeChannel(value = {}) {
  const rawChannelName = typeof value.channelName === 'string' ? value.channelName.trim() : value.channelName
  const compactChannelName = typeof rawChannelName === 'string'
    ? rawChannelName.toLowerCase().replace(/\s+/g, '')
    : ''
  const channelName = LEGACY_CHANNEL_NAMES.has(compactChannelName)
    ? DEFAULT_CHANNEL.channelName
    : rawChannelName

  return {
    ...DEFAULT_CHANNEL,
    ...value,
    channelName: channelName || DEFAULT_CHANNEL.channelName,
    dashboardComments: Array.isArray(value.dashboardComments)
      ? cloneList(value.dashboardComments)
      : cloneList(DEFAULT_DASHBOARD_COMMENTS),
    recentSubscribers: Array.isArray(value.recentSubscribers)
      ? cloneList(value.recentSubscribers)
      : cloneList(DEFAULT_RECENT_SUBSCRIBERS),
  }
}

function safeLocalStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}

function read() {
  const ls = safeLocalStorage()
  if (!ls) return normalizeChannel(DEFAULT_CHANNEL)
  try {
    const raw = ls.getItem(STORAGE_KEY)
    if (!raw) return normalizeChannel(DEFAULT_CHANNEL)
    const parsed = JSON.parse(raw)
    return normalizeChannel(parsed)
  } catch {
    return normalizeChannel(DEFAULT_CHANNEL)
  }
}

function write(obj) {
  const ls = safeLocalStorage()
  if (!ls) return
  ls.setItem(STORAGE_KEY, JSON.stringify(obj))
  cache = null
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(STORAGE_EVENT))
  }
}

export function getChannel() {
  if (cache === null) cache = read()
  return cache
}

export function updateChannel(patch) {
  const merged = normalizeChannel({ ...getChannel(), ...patch })
  write(merged)
  return merged
}

export function replaceChannel(next) {
  const normalized = normalizeChannel(next)
  write(normalized)
  return normalized
}

export function resetChannel() {
  write(normalizeChannel(DEFAULT_CHANNEL))
}

export function subscribe(listener) {
  if (typeof window === 'undefined') return () => {}
  const onCustom = () => {
    cache = null
    listener()
  }
  const onStorage = (e) => {
    if (e.key === STORAGE_KEY) {
      cache = null
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

export const CHANNEL_DEFAULTS = normalizeChannel(DEFAULT_CHANNEL)
