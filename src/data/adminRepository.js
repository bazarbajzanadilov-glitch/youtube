import { getSupabaseClient } from '../lib/supabaseClient.js'
import { validatePreparedStudioImage } from '../lib/studioImage.js'
import { normalizeAverageViewPercentage } from '../lib/videoMetrics.js'

export const STUDIO_CHANNEL_ID = '00000000-0000-0000-0000-000000000001'
const MEDIA_BUCKET = 'studio-media'

function requireNoError(result, message) {
  if (result?.error) {
    throw new Error(result.error.message || message)
  }
  return result?.data
}

function durationToSeconds(value) {
  const parts = String(value || '')
    .split(':')
    .map((part) => Number.parseInt(part, 10))

  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return 0
  if (parts.length === 2) return (parts[0] * 60) + parts[1]
  if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2]
  return Math.max(0, parts[0] || 0)
}

async function uploadMedia(file, folder) {
  if (!file) return null
  validatePreparedStudioImage(file)
  const supabase = getSupabaseClient()
  const path = `channels/${STUDIO_CHANNEL_ID}/${folder}/${crypto.randomUUID()}.webp`
  const result = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, {
      cacheControl: '31536000',
      contentType: 'image/webp',
      upsert: false,
    })

  requireNoError(result, 'Не удалось загрузить изображение')
  return path
}

async function removeMediaPaths(paths) {
  const removable = [...new Set(
    (Array.isArray(paths) ? paths : [paths])
      .filter((path) => path && !String(path).startsWith('static:')),
  )]
  if (!removable.length) return
  const supabase = getSupabaseClient()
  const result = await supabase.storage.from(MEDIA_BUCKET).remove(removable)
  requireNoError(result, 'Не удалось удалить изображение из хранилища')
}

async function removeMedia(path) {
  await removeMediaPaths([path])
}

async function removeUnreferencedMediaPaths(paths) {
  const candidates = [...new Set(
    (Array.isArray(paths) ? paths : [paths])
      .filter((path) => path && !String(path).startsWith('static:')),
  )]
  if (!candidates.length) return

  const supabase = getSupabaseClient()
  const [videoRefs, channelRefs] = await Promise.all([
    supabase.from('videos').select('cover_path').in('cover_path', candidates),
    supabase.from('channels').select('avatar_path').in('avatar_path', candidates),
  ])
  const referenced = new Set([
    ...requireNoError(videoRefs, 'Не удалось проверить ссылки на обложки')
      .map((item) => item.cover_path),
    ...requireNoError(channelRefs, 'Не удалось проверить ссылки на аватар')
      .map((item) => item.avatar_path),
  ].filter(Boolean))

  await removeMediaPaths(candidates.filter((path) => !referenced.has(path)))
}

function videoToRow(video, coverPath) {
  return {
    id: video.id,
    channel_id: STUDIO_CHANNEL_ID,
    title: video.title,
    cover_path: coverPath ?? video.coverPath ?? null,
    published_at: video.date,
    duration_seconds: durationToSeconds(video.duration),
    content_type: video.type || 'video',
    views: Math.max(0, Number(video.views) || 0),
    likes: Math.max(0, Number(video.likes) || 0),
    dislikes: Math.max(0, Number(video.dislikes) || 0),
    average_view_percentage: normalizeAverageViewPercentage(video.averageViewPercentage),
    revenue: Math.max(0, Number(video.revenue) || 0),
    analytics_profile: video.profile || 'gradualGrowth',
    auto_views: video._autoStats?.views === true,
    auto_revenue: video._autoStats?.revenue === true,
    created_at: typeof video.createdAt === 'number'
      ? new Date(video.createdAt).toISOString()
      : (video.createdAt || new Date().toISOString()),
  }
}

function channelToRow(channel, avatarPath) {
  return {
    id: STUDIO_CHANNEL_ID,
    channel_name: channel.channelName,
    country: channel.country,
    subscriber_count: Math.max(0, Number(channel.subscriberCount) || 0),
    monetization_enabled: channel.monetizationEnabled !== false,
    join_date: channel.joinDate,
    avatar_path: avatarPath ?? channel.avatarPath ?? null,
  }
}

function dashboardLists(channel) {
  const comments = Array.isArray(channel.dashboardComments)
    ? channel.dashboardComments.map((item, position) => ({
      id: item.id || crypto.randomUUID(),
      channel_id: STUDIO_CHANNEL_ID,
      author: item.author || '',
      age_label: item.age || '',
      body: item.text || '',
      avatar_color: item.avatarColor || '#525252',
      position,
    }))
    : []

  const subscribers = Array.isArray(channel.recentSubscribers)
    ? channel.recentSubscribers.map((item, position) => ({
      id: item.id || crypto.randomUUID(),
      channel_id: STUDIO_CHANNEL_ID,
      name: item.name || '',
      count_label: item.count || '',
      avatar_color: item.avatarColor || '#525252',
      position,
    }))
    : []

  return { comments, subscribers }
}

function subscriberStatsToRows(stats) {
  const byDate = new Map()
  for (const item of Array.isArray(stats) ? stats : []) {
    const date = String(item?.date || '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    byDate.set(date, {
      date,
      gained: Math.max(0, Number.parseInt(item.gained, 10) || 0),
      lost: Math.max(0, Number.parseInt(item.lost, 10) || 0),
    })
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export async function getAdminSession() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export function subscribeAdminAuth(listener) {
  const supabase = getSupabaseClient()
  const { data } = supabase.auth.onAuthStateChange((_event, session) => listener(session))
  return () => data.subscription.unsubscribe()
}

export async function signInAdmin(password) {
  const response = await fetch('/api/admin-login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  const result = await response.json().catch(() => ({}))

  if (
    import.meta.env.DEV
    && (!response.ok || !result.accessToken || !result.refreshToken)
  ) {
    const supabase = getSupabaseClient()
    const email = globalThis.atob('YmF6YXJiYWp6YW5hZGlsb3ZAZ21haWwuY29t')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error('Неверный пароль')
    return data.session
  }

  if (!response.ok) {
    throw new Error(result.error || 'Неверный пароль')
  }
  if (!result.accessToken || !result.refreshToken) {
    throw new Error('Не удалось выполнить вход')
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.setSession({
    access_token: result.accessToken,
    refresh_token: result.refreshToken,
  })
  if (error) throw error
  return data.session
}

export async function signOutAdmin() {
  const supabase = getSupabaseClient()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function updateAdminPassword(password) {
  const supabase = getSupabaseClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

export async function updateSitePassword(password) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) {
    throw new Error('Требуется вход в админку')
  }

  const response = await fetch('/api/admin-site-password', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify({ password }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result.error || 'Не удалось изменить пароль сайта')
  }
}

export async function isCurrentUserAdmin() {
  const supabase = getSupabaseClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) return false

  const { data, error } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', authData.user.id)
    .maybeSingle()

  if (error) return false
  return Boolean(data)
}

export async function createVideo(video) {
  const supabase = getSupabaseClient()
  const uploadedPath = video.coverFile
    ? await uploadMedia(video.coverFile, `videos/${video.id}`)
    : null
  try {
    const row = videoToRow(video, uploadedPath || video.coverPath)
    requireNoError(await supabase.from('videos').insert(row), 'Не удалось добавить видео')
  } catch (error) {
    if (uploadedPath) await removeMedia(uploadedPath).catch(() => {})
    throw error
  }
}

export async function updateVideo(video, previous) {
  const supabase = getSupabaseClient()
  const uploadedPath = video.coverFile
    ? await uploadMedia(video.coverFile, `videos/${video.id}`)
    : null
  const nextPath = video.removeCover ? null : (uploadedPath || video.coverPath || previous?.coverPath || null)
  const row = videoToRow(video, nextPath)

  try {
    requireNoError(
      await supabase.from('videos').update(row).eq('id', video.id),
      'Не удалось обновить видео',
    )
  } catch (error) {
    if (uploadedPath) await removeMedia(uploadedPath).catch(() => {})
    throw error
  }

  if (uploadedPath && previous?.coverPath && previous.coverPath !== uploadedPath) {
    await removeUnreferencedMediaPaths([previous.coverPath])
  }
  if (video.removeCover && previous?.coverPath) {
    await removeUnreferencedMediaPaths([previous.coverPath])
  }
}

export async function deleteVideos(ids) {
  if (!ids.length) return
  const supabase = getSupabaseClient()
  const existing = requireNoError(
    await supabase.from('videos').select('cover_path').in('id', ids),
    'Не удалось получить изображения удаляемых видео',
  )
  requireNoError(
    await supabase.from('videos').delete().in('id', ids),
    'Не удалось удалить видео',
  )
  await removeUnreferencedMediaPaths(existing.map((item) => item.cover_path))
}

export async function insertVideos(videos) {
  if (!videos.length) return
  const supabase = getSupabaseClient()
  const rows = videos.map((video) => videoToRow(video))
  requireNoError(await supabase.from('videos').insert(rows), 'Не удалось добавить видео')
}

export async function replaceVideos(videos) {
  const supabase = getSupabaseClient()
  const existing = requireNoError(
    await supabase.from('videos').select('cover_path').eq('channel_id', STUDIO_CHANNEL_ID),
    'Не удалось получить текущие изображения видео',
  )
  requireNoError(
    await supabase.rpc('replace_videos', {
      p_videos: videos.map((video) => videoToRow(video)),
    }),
    'Не удалось импортировать видео',
  )
  await removeUnreferencedMediaPaths(existing.map((item) => item.cover_path))
}

export async function replaceSubscriberDailyStats(stats) {
  const supabase = getSupabaseClient()
  requireNoError(
    await supabase.rpc('replace_subscriber_daily_stats', {
      p_stats: subscriberStatsToRows(stats),
    }),
    'Не удалось сохранить историю подписчиков',
  )
}

export async function saveChannel(channel, previous) {
  const supabase = getSupabaseClient()
  const uploadedPath = channel.avatarFile
    ? await uploadMedia(channel.avatarFile, 'avatar')
    : null
  const nextAvatarPath = channel.removeAvatar
    ? null
    : (uploadedPath || channel.avatarPath || previous?.avatarPath || null)
  const lists = dashboardLists(channel)

  try {
    requireNoError(
      await supabase.rpc('save_channel_project', {
        p_channel: channelToRow(channel, nextAvatarPath),
        p_comments: lists.comments,
        p_subscribers: lists.subscribers,
      }),
      'Не удалось сохранить канал',
    )
  } catch (error) {
    if (uploadedPath) await removeMedia(uploadedPath).catch(() => {})
    throw error
  }

  if (uploadedPath && previous?.avatarPath && previous.avatarPath !== uploadedPath) {
    await removeUnreferencedMediaPaths([previous.avatarPath])
  }
  if (channel.removeAvatar && previous?.avatarPath) {
    await removeUnreferencedMediaPaths([previous.avatarPath])
  }
}

export async function replaceProject(channel, videos) {
  const supabase = getSupabaseClient()
  const [currentChannel, currentVideos] = await Promise.all([
    supabase.from('channels').select('avatar_path').eq('id', STUDIO_CHANNEL_ID).maybeSingle(),
    supabase.from('videos').select('cover_path').eq('channel_id', STUDIO_CHANNEL_ID),
  ])
  requireNoError(currentChannel, 'Не удалось получить текущее изображение канала')
  requireNoError(currentVideos, 'Не удалось получить текущие изображения видео')
  const lists = dashboardLists(channel)
  requireNoError(
    await supabase.rpc('replace_project', {
      p_channel: channelToRow(channel),
      p_videos: videos.map((video) => videoToRow(video)),
      p_comments: lists.comments,
      p_subscribers: lists.subscribers,
    }),
    'Не удалось импортировать проект',
  )

  await removeUnreferencedMediaPaths([
    currentChannel.data?.avatar_path,
    ...currentVideos.data.map((item) => item.cover_path),
  ])
}
