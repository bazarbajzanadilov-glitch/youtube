import { getSupabaseClient } from '../lib/supabaseClient.js'

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

function mediaExtension(file) {
  const fromName = String(file?.name || '').split('.').pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName
  const fromType = String(file?.type || '').split('/').pop()?.toLowerCase()
  return fromType && /^[a-z0-9]{2,5}$/.test(fromType) ? fromType : 'bin'
}

async function uploadMedia(file, folder) {
  if (!file) return null
  const supabase = getSupabaseClient()
  const path = `channels/${STUDIO_CHANNEL_ID}/${folder}/${crypto.randomUUID()}.${mediaExtension(file)}`
  const result = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false })

  requireNoError(result, 'Не удалось загрузить изображение')
  return path
}

async function removeMedia(path) {
  if (!path || String(path).startsWith('static:')) return
  const supabase = getSupabaseClient()
  const result = await supabase.storage.from(MEDIA_BUCKET).remove([path])
  requireNoError(result, 'Не удалось удалить старое изображение')
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

export async function signInAdmin(email, password) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
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
  const row = videoToRow(video, uploadedPath || video.coverPath)
  requireNoError(await supabase.from('videos').insert(row), 'Не удалось добавить видео')
}

export async function updateVideo(video, previous) {
  const supabase = getSupabaseClient()
  const uploadedPath = video.coverFile
    ? await uploadMedia(video.coverFile, `videos/${video.id}`)
    : null
  const nextPath = video.removeCover ? null : (uploadedPath || video.coverPath || previous?.coverPath || null)
  const row = videoToRow(video, nextPath)

  requireNoError(
    await supabase.from('videos').update(row).eq('id', video.id),
    'Не удалось обновить видео',
  )

  if (uploadedPath && previous?.coverPath && previous.coverPath !== uploadedPath) {
    await removeMedia(previous.coverPath)
  }
  if (video.removeCover && previous?.coverPath) {
    await removeMedia(previous.coverPath)
  }
}

export async function deleteVideos(ids) {
  if (!ids.length) return
  const supabase = getSupabaseClient()
  requireNoError(
    await supabase.from('videos').delete().in('id', ids),
    'Не удалось удалить видео',
  )
}

export async function insertVideos(videos) {
  if (!videos.length) return
  const supabase = getSupabaseClient()
  const rows = videos.map((video) => videoToRow(video))
  requireNoError(await supabase.from('videos').insert(rows), 'Не удалось добавить видео')
}

export async function replaceVideos(videos) {
  const supabase = getSupabaseClient()
  requireNoError(
    await supabase.rpc('replace_videos', {
      p_videos: videos.map((video) => videoToRow(video)),
    }),
    'Не удалось импортировать видео',
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

  requireNoError(
    await supabase.rpc('save_channel_project', {
      p_channel: channelToRow(channel, nextAvatarPath),
      p_comments: lists.comments,
      p_subscribers: lists.subscribers,
    }),
    'Не удалось сохранить канал',
  )

  if (uploadedPath && previous?.avatarPath && previous.avatarPath !== uploadedPath) {
    await removeMedia(previous.avatarPath)
  }
  if (channel.removeAvatar && previous?.avatarPath) {
    await removeMedia(previous.avatarPath)
  }
}

export async function replaceProject(channel, videos) {
  const supabase = getSupabaseClient()
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
}
