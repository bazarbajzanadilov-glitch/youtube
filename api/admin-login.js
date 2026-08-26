import { createClient } from '@supabase/supabase-js'
import {
  createSiteSession,
  requestUsesHttps,
  siteCookie,
} from '../server/siteSession.js'

const ADMIN_EMAIL = 'bazarbajzanadilov@gmail.com'

function supabaseConfig() {
  const url = process.env.VITE_SUPABASE_URL
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!url || !publishableKey || !secretKey) {
    throw new Error('Supabase server environment is not configured')
  }
  return { url, publishableKey, secretKey }
}

function bearerToken(request) {
  const header = request.headers?.get?.('authorization')
    || request.headers?.authorization
    || ''
  const match = String(header).match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || ''
}

function passwordFrom(request) {
  return typeof request.body?.password === 'string' ? request.body.password : ''
}

function clientOptions() {
  return {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
}

function setAuthorizedSiteCookie(request, response) {
  const token = createSiteSession(process.env.SITE_SESSION_SECRET)
  response.setHeader('Set-Cookie', siteCookie(token, {
    secure: requestUsesHttps(request),
  }))
}

export function createAdminLoginHandler({ createSupabaseClient = createClient } = {}) {
  return async function handler(request, response) {
    response.setHeader('Cache-Control', 'private, no-store')

    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST')
      return response.status(405).json({ error: 'Method not allowed' })
    }

    try {
      const { url, publishableKey, secretKey } = supabaseConfig()
      const authClient = createSupabaseClient(url, publishableKey, clientOptions())
      const token = bearerToken(request)
      let user
      let session = null

      if (token) {
        const { data, error } = await authClient.auth.getUser(token)
        if (error || !data?.user) {
          return response.status(401).json({ error: 'Сессия админки истекла' })
        }
        user = data.user
      } else {
        const password = passwordFrom(request)
        if (!password) {
          return response.status(400).json({ error: 'Введите пароль' })
        }

        const { data, error } = await authClient.auth.signInWithPassword({
          email: ADMIN_EMAIL,
          password,
        })
        if (error || !data?.session || !data?.user) {
          return response.status(401).json({ error: 'Неверный пароль' })
        }
        user = data.user
        session = data.session
      }

      const adminClient = createSupabaseClient(url, secretKey, clientOptions())
      const { data: admin, error: adminError } = await adminClient
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (adminError) throw adminError
      if (!admin) {
        if (session) await authClient.auth.signOut().catch(() => {})
        return response.status(403).json({ error: 'Нет доступа к админке' })
      }

      setAuthorizedSiteCookie(request, response)
      if (!session) return response.status(200).json({ ok: true })

      return response.status(200).json({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
      })
    } catch {
      return response.status(500).json({ error: 'Не удалось выполнить вход' })
    }
  }
}

export default createAdminLoginHandler()
