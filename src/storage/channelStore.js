/**
 * Канал-уровневое хранилище (зеркало videoStore.js).
 * Один объект, ключ `yt-studio-channel`. SSR-safe через ленивый снапшот.
 */

const STORAGE_KEY = 'yt-studio-channel-v3'
const STORAGE_EVENT = 'yt-studio-channel-update'

const DEFAULT_DASHBOARD_COMMENTS = [
  {
    id: 'comment-risk-plan',
    author: '@risk.plan',
    age: '2 дня назад',
    text: 'Разбор по риску понятный, жду продолжение по входам.',
    avatarColor: '#245c5a',
  },
  {
    id: 'comment-market-watch',
    author: '@market.watch',
    age: '5 дней назад',
    text: 'Сетап отработал почти по плану, спасибо за уровни.',
    avatarColor: '#3b5f38',
  },
  {
    id: 'comment-profit-log',
    author: '@profit.log',
    age: '1 неделю назад',
    text: 'Формат с доходом за неделю заходит лучше всего.',
    avatarColor: '#625527',
  },
]

const DEFAULT_RECENT_SUBSCRIBERS = [
  { id: 'sub-scalper', name: 'Scalper KZ', count: '3,24 тыс. подписчиков', avatarColor: '#245c5a' },
  { id: 'sub-crypto-desk', name: 'Crypto Desk', count: '105 подписчиков', avatarColor: '#4a5f36' },
  { id: 'sub-futures-room', name: 'Futures Room', count: '23 подписчика', avatarColor: '#625527' },
]

const DEFAULT_CHANNEL = {
  channelName: 'TRADING INSIDER',
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

const LEGACY_CHANNEL_NAMES = new Set([
  ['rest', 'sheets'].join(''),
  ['rest', 'shits'].join(''),
  'trading1',
  ['pren', 'tosov'].join(''),
])

function hasLegacyDashboardContent(list) {
  const text = cloneList(list)
    .map((item) => Object.values(item).join(' '))
    .join(' ')
    .toLowerCase()
  return [
    ['ani', 'me'].join(''),
    'tvman',
    'titah',
    'football',
    'nurbolat',
    'az1zbek',
    'сканер',
    'код не работает',
  ].some((needle) => text.includes(needle))
}

function normalizeChannel(value = {}) {
  const rawChannelName = typeof value.channelName === 'string' ? value.channelName : value.channelName
  const compactChannelName = typeof rawChannelName === 'string'
    ? rawChannelName.toLowerCase().replace(/\s+/g, '')
    : ''
  const channelName = LEGACY_CHANNEL_NAMES.has(compactChannelName)
    ? DEFAULT_CHANNEL.channelName
    : rawChannelName

  const dashboardComments = Array.isArray(value.dashboardComments)
    ? cloneList(value.dashboardComments)
    : cloneList(DEFAULT_DASHBOARD_COMMENTS)
  const recentSubscribers = Array.isArray(value.recentSubscribers)
    ? cloneList(value.recentSubscribers)
    : cloneList(DEFAULT_RECENT_SUBSCRIBERS)

  return {
    ...DEFAULT_CHANNEL,
    ...value,
    channelName: typeof channelName === 'string' && channelName.trim() === ''
      ? DEFAULT_CHANNEL.channelName
      : (channelName || DEFAULT_CHANNEL.channelName),
    dashboardComments: hasLegacyDashboardContent(dashboardComments)
      ? cloneList(DEFAULT_DASHBOARD_COMMENTS)
      : dashboardComments,
    recentSubscribers: hasLegacyDashboardContent(recentSubscribers)
      ? cloneList(DEFAULT_RECENT_SUBSCRIBERS)
      : recentSubscribers,
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
    const normalized = normalizeChannel(parsed)
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      ls.setItem(STORAGE_KEY, JSON.stringify(normalized))
    }
    return normalized
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
