import { createClient } from '@supabase/supabase-js'
import { hashPassword } from '../server/passwordHash.js'
import { isSiteRequestAuthorized } from '../server/siteSession.js'

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
  const header = String(request.headers?.authorization || '')
  return header.startsWith('Bearer ') ? header.slice(7) : ''
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
  if (password.length < 4) {
    return response.status(400).json({ error: 'Пароль сайта должен содержать не менее 4 символов' })
  }

  try {
    const { url, publishableKey, secretKey } = supabaseConfig()
    const token = bearerToken(request)
    if (!token) return response.status(401).json({ error: 'Требуется вход в админку' })

    const authClient = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: authData, error: authError } = await authClient.auth.getUser(token)
    if (authError || !authData.user) {
      return response.status(401).json({ error: 'Сессия админки истекла' })
    }

    const adminClient = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: admin, error: adminError } = await adminClient
      .from('admin_users')
      .select('user_id')
      .eq('user_id', authData.user.id)
      .maybeSingle()

    if (adminError || !admin) {
      return response.status(403).json({ error: 'Нет доступа к админке' })
    }

    const { error: updateError } = await adminClient
      .from('site_settings')
      .upsert({
        id: 'primary',
        site_password_hash: hashPassword(password),
        updated_at: new Date().toISOString(),
        updated_by: authData.user.id,
      }, { onConflict: 'id' })

    if (updateError) throw updateError
    return response.status(200).json({ ok: true })
  } catch {
    return response.status(500).json({ error: 'Не удалось изменить пароль сайта' })
  }
}
