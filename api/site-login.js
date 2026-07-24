import { createClient } from '@supabase/supabase-js'
import { verifyPasswordHash } from '../server/passwordHash.js'
import {
  createSiteSession,
  passwordsMatch,
  siteCookie,
} from '../server/siteSession.js'

function safeReturnTo(value) {
  const candidate = String(value || '/')
  return candidate.startsWith('/') && !candidate.startsWith('//') ? candidate : '/'
}

function loginHtml({ error = '', returnTo = '/' } = {}) {
  const escapedReturnTo = safeReturnTo(returnTo).replaceAll('&', '&amp;').replaceAll('"', '&quot;')
  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex,nofollow" />
    <title>Доступ к YouTube Studio</title>
    <style>
      :root{font-family:Arial,sans-serif;color:#f1f1f1;background:#0f0f0f;color-scheme:dark}
      *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% 15%,#242424 0,#0f0f0f 48%)}
      form{width:min(100%,390px);padding:34px;border:1px solid #303030;border-radius:18px;background:#181818;box-shadow:0 24px 70px #0008}
      .mark{display:grid;place-items:center;width:54px;height:38px;margin-bottom:22px;border-radius:12px;background:#f00;color:white;font-weight:800}
      h1{font-size:24px;margin:0 0 8px}p{margin:0 0 25px;color:#aaa;line-height:1.5}
      label{display:grid;gap:8px;color:#ddd;font-size:13px}input{width:100%;padding:14px 15px;border:1px solid #3f3f3f;border-radius:10px;background:#101010;color:#fff;font-size:18px;outline:none}
      input:focus{border-color:#3ea6ff;box-shadow:0 0 0 3px #3ea6ff22}
      button{width:100%;margin-top:18px;padding:13px;border:0;border-radius:999px;background:#f1f1f1;color:#0f0f0f;font-size:15px;font-weight:700;cursor:pointer}
      .error{margin:14px 0 0;padding:10px 12px;border-radius:9px;background:#3b1515;color:#ffb4b4;font-size:13px}
    </style>
  </head>
  <body>
    <form method="post" action="/api/site-login">
      <div class="mark">YT</div>
      <h1>Введите пароль</h1>
      <p>Этот сайт доступен только по общему паролю.</p>
      <input type="hidden" name="returnTo" value="${escapedReturnTo}" />
      <label>
        <span>Пароль сайта</span>
        <input name="password" type="password" inputmode="numeric" autocomplete="current-password" autofocus required />
      </label>
      ${error ? `<div class="error">${error}</div>` : ''}
      <button type="submit">Открыть сайт</button>
    </form>
  </body>
</html>`
}

function requestBody(request) {
  if (request.body && typeof request.body === 'object') return request.body
  if (typeof request.body === 'string') return Object.fromEntries(new URLSearchParams(request.body))
  return {}
}

async function sitePasswordMatches(password) {
  const url = process.env.VITE_SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY

  if (!url || !secret) {
    return passwordsMatch(password, process.env.SITE_PASSWORD)
  }

  const supabase = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabase
    .from('site_settings')
    .select('site_password_hash')
    .eq('id', 'primary')
    .maybeSingle()

  if (error) throw error
  if (data?.site_password_hash) {
    return verifyPasswordHash(password, data.site_password_hash)
  }
  return passwordsMatch(password, process.env.SITE_PASSWORD)
}

export default async function handler(request, response) {
  const returnTo = safeReturnTo(request.query?.returnTo || requestBody(request).returnTo)

  if (request.method === 'GET') {
    response.setHeader('Content-Type', 'text/html; charset=utf-8')
    return response.status(200).send(loginHtml({ returnTo }))
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const password = requestBody(request).password
  let matches
  try {
    matches = await sitePasswordMatches(password)
  } catch {
    return response.status(503).send(loginHtml({
      error: 'Вход временно недоступен',
      returnTo,
    }))
  }

  if (!matches) {
    response.setHeader('Content-Type', 'text/html; charset=utf-8')
    return response.status(401).send(loginHtml({
      error: 'Неверный пароль',
      returnTo,
    }))
  }

  const token = createSiteSession(process.env.SITE_SESSION_SECRET)
  response.setHeader('Set-Cookie', siteCookie(token, {
    secure: process.env.VERCEL_ENV !== 'development',
  }))
  response.setHeader('Location', returnTo)
  return response.status(303).end()
}
