import {
  normalizeVideo,
  randomDuration,
  randomTitle,
} from '../storage/videoStore.js'
import { CHANNEL_DEFAULTS } from '../storage/channelStore.js'
import * as adminRepository from './adminRepository.js'

const listeners = new Set()

let snapshot = {
  videos: [],
  channel: CHANNEL_DEFAULTS,
  totals: { count: 0, views: 0, likes: 0, dislikes: 0, revenue: 0 },
  loading: true,
  error: null,
}

let activeLoad = null
let loadRevision = 0
let mutationQueue = Promise.resolve()

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

export async function loadRemoteProject({ force = false } = {}) {
  if (activeLoad && !force) return activeLoad

  const revision = loadRevision + 1
  loadRevision = revision
  updateSnapshot({ loading: true, error: null })
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
        updateSnapshot({
          videos: Array.isArray(project.videos) ? project.videos : [],
          channel: project.channel || CHANNEL_DEFAULTS,
          loading: false,
          error: null,
        })
      }
      return project
    })
    .catch((error) => {
      if (revision === loadRevision) {
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
