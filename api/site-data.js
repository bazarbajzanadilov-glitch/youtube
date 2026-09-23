import { createClient } from '@supabase/supabase-js'
import {
  isSiteRequestAuthorized,
  SITE_SESSION_MAX_AGE,
} from '../server/siteSession.js'

const MEDIA_BUCKET = 'studio-media'
const STUDIO_CHANNEL_ID = '00000000-0000-0000-0000-000000000001'
const PAGE_SIZE = 1000

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
    .createSignedUrl(path, SITE_SESSION_MAX_AGE)
  if (error) return null
  return data.signedUrl
}

function requireData(result, label) {
  if (result.error) {
    const error = new Error(`${label}: ${result.error.message}`)
    error.code = result.error.code
    throw error
  }
  return result.data
}

async function fetchAllPages(buildQuery, label) {
  const rows = []
  let from = 0

  while (true) {
    const result = await buildQuery().range(from, from + PAGE_SIZE - 1)
    const page = requireData(result, label) || []
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
    from += PAGE_SIZE
  }
}

function isMissingRelation(error) {
  return error?.code === '42P01'
    || error?.code === 'PGRST205'
    || /relation .* does not exist/i.test(error?.message || '')
}

const PERFORMANCE_SECTIONS_TABLE = 'video_performance_sections'

function isMissingPerformanceSections(error) {
  return isMissingRelation(error)
    && new RegExp(PERFORMANCE_SECTIONS_TABLE, 'i').test(error?.message || '')
}

/* Раздел «С момента публикации» появился позже остальной схемы: пока миграция
   не применена, сайт работает на дефолтах, а не падает целиком. */
async function tolerantPerformanceSections(load) {
  try {
    return await load()
  } catch (error) {
    if (isMissingPerformanceSections(error)) return []
    throw error
  }
}

function isMissingVideoDailyStats(error) {
  return isMissingRelation(error)
    && /video_daily_stats/i.test(error?.message || '')
}

export function siteDataErrorDetails(error) {
  if (isMissingVideoDailyStats(error)) {
    return {
      status: 503,
      message: 'Схема аналитики не готова: отсутствует таблица video_daily_stats. Примените миграции Supabase.',
    }
  }
  return { status: 500, message: 'Не удалось загрузить данные сайта' }
}

function buildRevision(sources) {
  let latest = ''
  const counts = []

  for (const [name, rows] of sources) {
    const list = Array.isArray(rows) ? rows : []
    counts.push(`${name}:${list.length}`)
    for (const row of list) {
      const updatedAt = typeof row?.updated_at === 'string' ? row.updated_at : ''
      if (updatedAt > latest) latest = updatedAt
    }
  }

  return `${latest || '0'}|${counts.join('|')}`
}

async function latestRows(
  supabase,
  table,
  filterColumn = 'channel_id',
) {
  let query = supabase
    .from(table)
    .select('updated_at', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .limit(1)

  query = query.eq(filterColumn, STUDIO_CHANNEL_ID)
  const result = await query
  const rows = requireData(result, table)
  return {
    rows,
    count: Number.isInteger(result.count) ? result.count : rows.length,
  }
}

async function loadRevision(supabase) {
  const entries = await Promise.all([
    latestRows(supabase, 'channels', 'id'),
    latestRows(supabase, 'videos'),
    latestRows(supabase, 'dashboard_comments'),
    latestRows(supabase, 'recent_subscribers'),
    latestRows(supabase, 'subscriber_daily_stats'),
    latestRows(supabase, 'video_daily_stats'),
    tolerantPerformanceSections(() => latestRows(supabase, PERFORMANCE_SECTIONS_TABLE))
      .then((entry) => (Array.isArray(entry) ? { rows: [], count: 0 } : entry)),
  ])
  const names = [
    'channel',
    'videos',
    'comments',
    'recentSubscribers',
    'subscriberDailyStats',
    'videoDailyStats',
    'performanceSections',
  ]
  let latest = ''
  const counts = []

  entries.forEach((entry, index) => {
    const updatedAt = entry.rows[0]?.updated_at || ''
    if (updatedAt > latest) latest = updatedAt
    counts.push(`${names[index]}:${entry.count}`)
  })

  return `${latest || '0'}|${counts.join('|')}`
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
    if (String(request.query?.revision || '') === '1') {
      const revision = await loadRevision(supabase)
      response.setHeader('Cache-Control', 'private, no-store')
      return response.status(200).json({ revision })
    }

    const [
      channelResult,
      videoRows,
      commentRows,
      subscriberRows,
      subscriberDailyRows,
      videoDailyRows,
      performanceSectionRows,
    ] = await Promise.all([
      supabase.from('channels').select('*').eq('id', STUDIO_CHANNEL_ID).single(),
      fetchAllPages(
        () => supabase
          .from('videos')
          .select('*')
          .eq('channel_id', STUDIO_CHANNEL_ID)
          .order('published_at', { ascending: false })
          .order('id', { ascending: true }),
        'videos',
      ),
      fetchAllPages(
        () => supabase
          .from('dashboard_comments')
          .select('*')
          .eq('channel_id', STUDIO_CHANNEL_ID)
          .order('position', { ascending: true })
          .order('id', { ascending: true }),
        'dashboard_comments',
      ),
      fetchAllPages(
        () => supabase
          .from('recent_subscribers')
          .select('*')
          .eq('channel_id', STUDIO_CHANNEL_ID)
          .order('position', { ascending: true })
          .order('id', { ascending: true }),
        'recent_subscribers',
      ),
      fetchAllPages(
        () => supabase
          .from('subscriber_daily_stats')
          .select('date, gained, lost, updated_at')
          .eq('channel_id', STUDIO_CHANNEL_ID)
          .order('date', { ascending: true }),
        'subscriber_daily_stats',
      ),
      fetchAllPages(
        () => supabase
          .from('video_daily_stats')
          .select('video_id, date, views, watch_seconds, engaged_views, impressions, likes, comments, revenue, updated_at')
          .eq('channel_id', STUDIO_CHANNEL_ID)
          .order('date', { ascending: true })
          .order('video_id', { ascending: true }),
        'video_daily_stats',
      ),
      tolerantPerformanceSections(() => fetchAllPages(
        () => supabase
          .from(PERFORMANCE_SECTIONS_TABLE)
          .select('variant, published_at, total_views, typical_views, watch_hours, typical_watch_hours, subscribers_gained, revenue_tenge, curve_shape, realtime_views_48h, traffic_sources, updated_at')
          .eq('channel_id', STUDIO_CHANNEL_ID)
          .order('variant', { ascending: true }),
        PERFORMANCE_SECTIONS_TABLE,
      )),
    ])

    const channelRow = requireData(channelResult, 'Канал')
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
    const subscriberDailyStats = subscriberDailyRows.map((item) => ({
      date: item.date,
      gained: Math.max(0, Number(item.gained) || 0),
      lost: Math.max(0, Number(item.lost) || 0),
    }))
    const videoDailyStats = videoDailyRows.map((item) => ({
      videoId: String(item.video_id),
      date: item.date,
      views: Math.max(0, Number(item.views) || 0),
      watchSeconds: Math.max(0, Number(item.watch_seconds) || 0),
      engagedViews: Math.max(0, Number(item.engaged_views) || 0),
      impressions: Math.max(0, Number(item.impressions) || 0),
      likes: Math.max(0, Number(item.likes) || 0),
      comments: Math.max(0, Number(item.comments) || 0),
      revenue: Math.max(0, Number(item.revenue) || 0),
    }))

    const performanceSections = Object.fromEntries(performanceSectionRows.map((item) => [
      String(item.variant),
      {
        variant: String(item.variant),
        publishedAt: item.published_at,
        totalViews: Math.max(0, Number(item.total_views) || 0),
        typicalViews: Math.max(0, Number(item.typical_views) || 0),
        watchHours: Math.max(0, Number(item.watch_hours) || 0),
        typicalWatchHours: Math.max(0, Number(item.typical_watch_hours) || 0),
        subscribersGained: Math.max(0, Number(item.subscribers_gained) || 0),
        revenueTenge: Math.max(0, Number(item.revenue_tenge) || 0),
        curveShape: item.curve_shape,
        realtimeViews48h: Math.max(0, Number(item.realtime_views_48h) || 0),
        trafficSources: Array.isArray(item.traffic_sources) ? item.traffic_sources : undefined,
      },
    ]))

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
          averageViewPercentage: item.average_view_percentage == null
            ? null
            : Number(item.average_view_percentage),
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
      subscriberDailyStats,
      videoDailyStats,
      performanceSections,
    }
    const revision = buildRevision([
      ['channel', [channelRow]],
      ['videos', videoRows],
      ['comments', commentRows],
      ['recentSubscribers', subscriberRows],
      ['subscriberDailyStats', subscriberDailyRows],
      ['videoDailyStats', videoDailyRows],
      ['performanceSections', performanceSectionRows],
    ])

    response.setHeader('Cache-Control', 'private, no-store')
    return response.status(200).json({
      revision,
      channel,
      videos,
      dashboardComments,
      recentSubscribers,
      subscriberDailyStats,
      videoDailyStats,
      performanceSections,
    })
  } catch (error) {
    console.error('site-data', error?.message || error)
    const details = siteDataErrorDetails(error)
    return response.status(details.status).json({ error: details.message })
  }
}
