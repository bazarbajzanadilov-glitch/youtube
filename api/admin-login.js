import { createClient } from '@supabase/supabase-js'
import { isSiteRequestAuthorized } from '../server/siteSession.js'

const ADMIN_EMAIL = 'bazarbajzanadilov@gmail.com'

function authClient() {
  const url = process.env.VITE_SUPABASE_URL
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !publishableKey) {
    throw new Error('Supabase server environment is not configured')
  }

  return createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'private, no-store')

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  if (!isSiteRequestAuthorized(request)) {
    return response.status(401).json({ error: 'Требуется пароль сайта' })
  }

  const password = typeof request.body?.password === 'string'
    ? request.body.password
    : ''

  if (!password) {
    return response.status(400).json({ error: 'Введите пароль' })
  }

  try {
    const supabase = authClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password,
    })

    if (error || !data.session) {
      return response.status(401).json({ error: 'Неверный пароль' })
    }

    const { data: admin, error: adminError } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', data.user.id)
      .maybeSingle()

    if (adminError || !admin) {
      await supabase.auth.signOut().catch(() => {})
      return response.status(403).json({ error: 'Нет доступа к админке' })
    }

    return response.status(200).json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    })
  } catch {
    return response.status(500).json({ error: 'Не удалось выполнить вход' })
  }
}
