import { createClient } from '@supabase/supabase-js'
import { isSiteRequestAuthorized } from '../server/siteSession.js'

const MEDIA_BUCKET = 'studio-media'

function serverClient() {
  const url = process.env.VITE_SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY
  if (!url || !secret) throw new Error('Supabase server environment is not configured')
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function durationLabel(seconds) {
  const value = Math.max(0, Number(seconds) || 0)
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const rest = value % 60
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

async function mediaUrl(supabase, path) {
  if (!path) return null
  if (String(path).startsWith('static:')) return String(path).slice(7)
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(path, 3600)
  if (error) return null
  return data.signedUrl
}

function requireData(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  return result.data
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'Method not allowed' })
  }
  if (!isSiteRequestAuthorized(request)) {
    return response.status(401).json({ error: 'Требуется пароль сайта' })
  }

  try {
    const supabase = serverClient()
    const [channelResult, videosResult, commentsResult, subscribersResult] = await Promise.all([
      supabase.from('channels').select('*').limit(1).single(),
      supabase.from('videos').select('*').order('published_at', { ascending: false }),
      supabase.from('dashboard_comments').select('*').order('position', { ascending: true }),
      supabase.from('recent_subscribers').select('*').order('position', { ascending: true }),
    ])

    const channelRow = requireData(channelResult, 'Канал')
    const videoRows = requireData(videosResult, 'Видео')
    const commentRows = requireData(commentsResult, 'Комментарии')
    const subscriberRows = requireData(subscribersResult, 'Подписчики')

    const dashboardComments = commentRows.map((item) => ({
      id: item.id,
      author: item.author,
      age: item.age_label,
      text: item.body,
      avatarColor: item.avatar_color,
    }))
    const recentSubscribers = subscriberRows.map((item) => ({
      id: item.id,
      name: item.name,
      count: item.count_label,
      avatarColor: item.avatar_color,
    }))

    const [avatar, videos] = await Promise.all([
      mediaUrl(supabase, channelRow.avatar_path),
      Promise.all(videoRows.map(async (item) => {
        const likes = Math.max(0, Number(item.likes) || 0)
        const dislikes = Math.max(0, Number(item.dislikes) || 0)
        return {
          id: item.id,
          title: item.title,
          cover: await mediaUrl(supabase, item.cover_path),
          coverPath: item.cover_path,
          date: item.published_at,
          duration: durationLabel(item.duration_seconds),
          type: item.content_type,
          views: Number(item.views) || 0,
          likes,
          dislikes,
          likePct: likes + dislikes === 0 ? null : likes / (likes + dislikes),
          revenue: Number(item.revenue) || 0,
          profile: item.analytics_profile,
          _autoStats: {
            views: item.auto_views === true,
            revenue: item.auto_revenue === true,
          },
          createdAt: item.created_at,
        }
      })),
    ])

    const channel = {
      channelName: channelRow.channel_name,
      country: channelRow.country,
      subscriberCount: Number(channelRow.subscriber_count) || 0,
      monetizationEnabled: channelRow.monetization_enabled !== false,
      joinDate: channelRow.join_date,
      avatar,
      avatarPath: channelRow.avatar_path,
      dashboardComments,
      recentSubscribers,
    }

    response.setHeader('Cache-Control', 'private, no-store')
    return response.status(200).json({
      channel,
      videos,
      dashboardComments,
      recentSubscribers,
    })
  } catch (error) {
    console.error('site-data', error?.message || error)
    return response.status(500).json({ error: 'Не удалось загрузить данные сайта' })
  }
}
