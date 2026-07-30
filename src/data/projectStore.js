import {
  normalizeVideo,
  randomDuration,
  randomTitle,
} from '../storage/videoStore.js'
import { CHANNEL_DEFAULTS } from '../storage/channelStore.js'
import * as adminRepository from './adminRepository.js'

const listeners = new Set()
const REMOTE_REFRESH_INTERVAL_MS = 10_000

let snapshot = {
  videos: [],
  channel: CHANNEL_DEFAULTS,
  totals: { count: 0, views: 0, likes: 0, dislikes: 0, revenue: 0 },
  revision: null,
  loading: true,
  error: null,
}

let activeLoad = null
let activeRevisionCheck = null
let loadRevision = 0
let mutationQueue = Promise.resolve()
let refreshStarted = false

function isPageVisible() {
  return typeof document !== 'undefined' && document.visibilityState === 'visible'
}

async function readRemoteRevision() {
  const response = await fetch('/api/site-data?revision=1', {
    credentials: 'include',
    cache: 'no-store',
    headers: { accept: 'application/json' },
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error || `Не удалось проверить обновления (${response.status})`)
  }
  const payload = await response.json()
  return typeof payload?.revision === 'string' ? payload.revision : null
}

export async function refreshRemoteProjectIfChanged() {
  if (!isPageVisible() || activeLoad) return false
  if (activeRevisionCheck) return activeRevisionCheck

  activeRevisionCheck = readRemoteRevision()
    .then(async (revision) => {
      if (!revision || revision === snapshot.revision) return false
      await loadRemoteProject({ force: true, silent: true })
      return true
    })
    .finally(() => {
      activeRevisionCheck = null
    })

  return activeRevisionCheck
}

function startRemoteRefresh() {
  if (
    refreshStarted
    || typeof window === 'undefined'
    || typeof document === 'undefined'
  ) return

  refreshStarted = true
  const refresh = () => {
    refreshRemoteProjectIfChanged().catch(() => {})
  }

  window.setInterval(() => {
    if (isPageVisible()) refresh()
  }, REMOTE_REFRESH_INTERVAL_MS)
  window.addEventListener('focus', refresh)
  document.addEventListener('visibilitychange', () => {
    if (isPageVisible()) refresh()
  })
}

function totalsFor(videos) {
  return {
    count: videos.length,
    views: videos.reduce((sum, video) => sum + (Number(video.views) || 0), 0),
    likes: videos.reduce((sum, video) => sum + (Number(video.likes) || 0), 0),
    dislikes: videos.reduce((sum, video) => sum + (Number(video.dislikes) || 0), 0),
    revenue: videos.reduce((sum, video) => sum + (Number(video.revenue) || 0), 0),
  }
}

function updateSnapshot(patch) {
  const next = { ...snapshot, ...patch }
  if (patch.videos) next.totals = totalsFor(patch.videos)
  snapshot = next
  listeners.forEach((listener) => listener())
}

export function subscribeProject(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getVideosSnapshot() {
  return snapshot.videos
}

export function getChannelSnapshot() {
  return snapshot.channel
}

export function getTotalsSnapshot() {
  return snapshot.totals
}

export function getRemoteStatusSnapshot() {
  return { loading: snapshot.loading, error: snapshot.error }
}

export function getProjectSnapshot() {
  return snapshot
}

export async function loadRemoteProject({ force = false, silent = false } = {}) {
  startRemoteRefresh()
  if (activeLoad && !force) return activeLoad

  const revision = loadRevision + 1
  loadRevision = revision
  if (!silent) updateSnapshot({ loading: true, error: null })
  const request = fetch('/api/site-data', {
    credentials: 'include',
    cache: 'no-store',
    headers: { accept: 'application/json' },
  })
    .then(async (response) => {
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || `Не удалось загрузить данные (${response.status})`)
      }
      return response.json()
    })
    .then((project) => {
      if (revision === loadRevision) {
        const channel = project.channel && typeof project.channel === 'object'
          ? {
            ...CHANNEL_DEFAULTS,
            ...project.channel,
            videoDailyStats: Array.isArray(project.channel.videoDailyStats)
              ? project.channel.videoDailyStats
              : (Array.isArray(project.videoDailyStats) ? project.videoDailyStats : []),
          }
          : CHANNEL_DEFAULTS
        updateSnapshot({
          videos: Array.isArray(project.videos) ? project.videos : [],
          channel,
          revision: typeof project.revision === 'string' ? project.revision : null,
          loading: false,
          error: null,
        })
      }
      return project
    })
    .catch((error) => {
      if (revision === loadRevision && !silent) {
        updateSnapshot({ loading: false, error: error.message || 'Не удалось загрузить данные' })
      }
      throw error
    })
    .finally(() => {
      if (revision === loadRevision) activeLoad = null
    })

  activeLoad = request
  return request
}

async function mutate(action) {
  const run = mutationQueue.then(async () => {
    if (snapshot.error) {
      await loadRemoteProject({ force: true })
    }
    try {
      await action()
    } catch (error) {
      await loadRemoteProject({ force: true }).catch(() => {})
      throw error
    }
    try {
      await loadRemoteProject({ force: true })
    } catch (error) {
      throw new Error(
        'Изменения сохранены, но экран не удалось обновить. Обновите страницу перед следующей правкой.',
        { cause: error },
      )
    }
  })
  mutationQueue = run.catch(() => {})
  return run
}

export async function addRemoteVideo(input) {
  const normalized = normalizeVideo(input)
  await mutate(() => adminRepository.createVideo({
    ...normalized,
    coverPath: input.coverPath || null,
    coverFile: input.coverFile || null,
  }))
  return normalized
}

export async function updateRemoteVideo(id, patch) {
  let normalized = null
  await mutate(async () => {
    const previous = snapshot.videos.find((video) => video.id === id)
    if (!previous) return
    normalized = normalizeVideo(patch, { base: previous })
    await adminRepository.updateVideo({
      ...normalized,
      id,
      coverPath: patch.coverPath ?? previous.coverPath ?? null,
      coverFile: patch.coverFile || null,
      removeCover: patch.removeCover === true,
    }, previous)
  })
  return normalized
}

export async function removeRemoteVideo(id) {
  await mutate(() => adminRepository.deleteVideos([id]))
}

export async function clearRemoteVideos() {
  await mutate(() => adminRepository.deleteVideos(snapshot.videos.map((video) => video.id)))
}

export async function removeManyRemote(ids) {
  await mutate(() => adminRepository.deleteVideos(ids))
}

export async function bulkAddRemote(count) {
  const now = Date.now()
  const videos = Array.from({ length: count }, (_, index) => {
    const title = randomTitle()
    const date = new Date(now - Math.floor(Math.random() * 365) * 86400000).toISOString().slice(0, 10)
    return normalizeVideo({
      title,
      date,
      duration: randomDuration(),
      autoViews: true,
      autoRevenue: true,
      createdAt: now + index,
    })
  })
  await mutate(() => adminRepository.insertVideos(videos))
}

export async function importRemoteVideos(input) {
  const videos = Array.isArray(input)
    ? input
      .filter((video) => video && typeof video === 'object')
      .map((video) => ({ ...normalizeVideo(video), coverPath: video.coverPath || null }))
    : []
  await mutate(() => adminRepository.replaceVideos(videos))
}

export function exportRemoteVideos() {
  const data = JSON.stringify(snapshot.videos, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'videos.json'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function saveRemoteChannel(next) {
  let merged = null
  await mutate(async () => {
    const previous = snapshot.channel
    merged = { ...previous, ...next }
    await adminRepository.saveChannel(merged, previous)
  })
  return merged
}

export async function saveRemoteSubscriberDailyStats(stats) {
  await mutate(() => adminRepository.replaceSubscriberDailyStats(stats))
}

export async function replaceRemoteProject(channel, videos) {
  const normalizedVideos = Array.isArray(videos)
    ? videos
      .filter((video) => video && typeof video === 'object')
      .map((video) => ({ ...normalizeVideo(video), coverPath: video.coverPath || null }))
    : []
  await mutate(async () => {
    const subscriberDailyStats = Array.isArray(channel?.subscriberDailyStats)
      ? channel.subscriberDailyStats
      : snapshot.channel.subscriberDailyStats
    const nextChannel = { ...CHANNEL_DEFAULTS, ...channel, subscriberDailyStats }
    await adminRepository.replaceProject(nextChannel, normalizedVideos)
    await adminRepository.replaceSubscriberDailyStats(nextChannel.subscriberDailyStats)
  })
}
