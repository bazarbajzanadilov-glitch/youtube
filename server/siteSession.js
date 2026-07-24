import { createHmac, timingSafeEqual } from 'node:crypto'

export const SITE_COOKIE_NAME = 'yt_site_session'
export const SITE_SESSION_MAX_AGE = 60 * 60 * 24 * 7

function encode(value) {
  return Buffer.from(String(value)).toString('base64url')
}

function signature(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left))
  const b = Buffer.from(String(right))
  return a.length === b.length && timingSafeEqual(a, b)
}

export function passwordsMatch(input, expected) {
  return safeEqual(input || '', expected || '')
}

export function createSiteSession(secret, now = Date.now()) {
  if (!secret) throw new Error('SITE_SESSION_SECRET is not configured')
  const payload = encode(JSON.stringify({
    exp: Math.floor(now / 1000) + SITE_SESSION_MAX_AGE,
    scope: 'site',
  }))
  return `${payload}.${signature(payload, secret)}`
}

export function verifySiteSession(token, secret, now = Date.now()) {
  if (!token || !secret) return false
  const [payload, suppliedSignature] = String(token).split('.')
  if (!payload || !suppliedSignature) return false
  if (!safeEqual(signature(payload, secret), suppliedSignature)) return false

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return parsed.scope === 'site' && Number(parsed.exp) > Math.floor(now / 1000)
  } catch {
    return false
  }
}

export function readCookie(header, name) {
  const cookies = String(header || '').split(';')
  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split('=')
    if (key === name) return decodeURIComponent(value.join('='))
  }
  return null
}

export function siteCookie(token, { secure = true, maxAge = SITE_SESSION_MAX_AGE } = {}) {
  return [
    `${SITE_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : '',
  ].filter(Boolean).join('; ')
}

export function isSiteRequestAuthorized(request) {
  const token = readCookie(request.headers?.cookie || request.headers?.get?.('cookie'), SITE_COOKIE_NAME)
  return verifySiteSession(token, process.env.SITE_SESSION_SECRET)
}
