/**
 * Канал-уровневое хранилище (зеркало videoStore.js).
 * Один объект, ключ `yt-studio-channel`. SSR-safe через ленивый снапшот.
 */

const STORAGE_KEY = 'yt-studio-channel'
const STORAGE_EVENT = 'yt-studio-channel-update'

const DEFAULT_CHANNEL = {
  channelName: 'Inside Trading',
  country: 'RU',
  subscriberCount: 12500,
  monetizationEnabled: true,
  rpm: 3.2,
  cpm: 8.1,
  joinDate: '2022-01-15',
  avatar: null,
}

let cache = null

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
  if (!ls) return { ...DEFAULT_CHANNEL }
  try {
    const raw = ls.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_CHANNEL }
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_CHANNEL, ...parsed }
  } catch {
    return { ...DEFAULT_CHANNEL }
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
  const merged = { ...getChannel(), ...patch }
  write(merged)
  return merged
}

export function resetChannel() {
  write({ ...DEFAULT_CHANNEL })
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

export const CHANNEL_DEFAULTS = DEFAULT_CHANNEL
