import assert from 'node:assert/strict'
import {
  createSiteSession,
  isSitePublicPath,
  passwordsMatch,
  readCookie,
  requestUsesHttps,
  SITE_COOKIE_NAME,
  SITE_SESSION_MAX_AGE,
  siteCookie,
  verifySiteSession,
} from '../server/siteSession.js'
import {
  hashPassword,
  verifyPasswordHash,
} from '../server/passwordHash.js'
import { createAdminLoginHandler } from '../api/admin-login.js'

const secret = 'test-secret-that-is-long-enough-for-verification'
const now = Date.UTC(2026, 6, 24, 12, 0, 0)
const token = createSiteSession(secret, now)

assert.equal(passwordsMatch('correct-password', 'correct-password'), true)
assert.equal(passwordsMatch('wrong-password', 'correct-password'), false)

const passwordHash = hashPassword('site-password')
assert.equal(passwordHash.includes('site-password'), false)
assert.equal(verifyPasswordHash('site-password', passwordHash), true)
assert.equal(verifyPasswordHash('wrong-password', passwordHash), false)
assert.equal(verifyPasswordHash('site-password', 'invalid'), false)
assert.equal(verifySiteSession(token, secret, now), true)
assert.equal(verifySiteSession(token, `${secret}-wrong`, now), false)
assert.equal(
  verifySiteSession(token, secret, now + (SITE_SESSION_MAX_AGE * 1000) + 1),
  false,
)

const cookie = siteCookie(token)
assert.match(cookie, new RegExp(`^${SITE_COOKIE_NAME}=`))
assert.match(cookie, /HttpOnly/)
assert.match(cookie, /Secure/)
assert.match(cookie, /SameSite=Lax/)
assert.match(cookie, new RegExp(`Max-Age=${SITE_SESSION_MAX_AGE}`))
assert.equal(readCookie(`another=value; ${cookie}`, SITE_COOKIE_NAME), token)

const localCookie = siteCookie(token, { secure: false })
assert.doesNotMatch(localCookie, /Secure/)

for (const pathname of [
  '/admin',
  '/admin/',
  '/api/admin-login',
  '/assets/index.js',
  '/fonts/studio.woff2',
  '/node_modules/vite/dist/client/env.mjs',
  '/src/main.jsx',
]) {
  assert.equal(isSitePublicPath(pathname), true, `${pathname} must be public`)
}
for (const pathname of ['/', '/api/site-data', '/api/admin-site-password']) {
  assert.equal(isSitePublicPath(pathname), false, `${pathname} must stay protected`)
}

assert.equal(requestUsesHttps({ url: 'http://localhost:5173/admin', headers: {} }), false)
assert.equal(requestUsesHttps({
  url: 'http://internal/admin',
  headers: { 'x-forwarded-proto': 'https' },
}), true)

function responseRecorder() {
  const state = { headers: new Map(), status: null, body: null }
  return {
    state,
    setHeader(name, value) {
      state.headers.set(String(name).toLowerCase(), value)
    },
    status(code) {
      state.status = code
      return this
    },
    json(body) {
      state.body = body
      return this
    },
  }
}

function fakeClientFactory({
  passwordAccepted = true,
  bearerAccepted = true,
  isAdmin = true,
  adminError = null,
} = {}) {
  const auth = {
    async signInWithPassword() {
      if (!passwordAccepted) return { data: {}, error: new Error('invalid') }
      return {
        data: {
          user: { id: 'admin-user' },
          session: { access_token: 'access-token', refresh_token: 'refresh-token' },
        },
        error: null,
      }
    },
    async getUser() {
      if (!bearerAccepted) return { data: {}, error: new Error('expired') }
      return { data: { user: { id: 'admin-user' } }, error: null }
    },
    async signOut() {
      return { error: null }
    },
  }
  const admin = {
    from() {
      return {
        select() { return this },
        eq() { return this },
        async maybeSingle() {
          return {
            data: isAdmin ? { user_id: 'admin-user' } : null,
            error: adminError,
          }
        },
      }
    },
  }
  return (_url, key) => key === 'publishable-test-key' ? { auth } : admin
}

async function invokeAdminLogin({ body = {}, authorization = '', factory } = {}) {
  const response = responseRecorder()
  const handler = createAdminLoginHandler({ createSupabaseClient: factory })
  await handler({
    method: 'POST',
    url: 'https://studio.example/admin',
    headers: authorization ? { authorization } : {},
    body,
  }, response)
  return response.state
}

const savedEnvironment = {
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  SITE_SESSION_SECRET: process.env.SITE_SESSION_SECRET,
}
Object.assign(process.env, {
  VITE_SUPABASE_URL: 'https://supabase.example',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-test-key',
  SUPABASE_SECRET_KEY: 'secret-test-key',
  SITE_SESSION_SECRET: secret,
})

const noPassword = await invokeAdminLogin({ factory: fakeClientFactory() })
assert.equal(noPassword.status, 400)
assert.equal(noPassword.headers.has('set-cookie'), false)

const wrongPassword = await invokeAdminLogin({
  body: { password: 'wrong' },
  factory: fakeClientFactory({ passwordAccepted: false }),
})
assert.equal(wrongPassword.status, 401)
assert.equal(wrongPassword.headers.has('set-cookie'), false)

const forbidden = await invokeAdminLogin({
  body: { password: 'correct' },
  factory: fakeClientFactory({ isAdmin: false }),
})
assert.equal(forbidden.status, 403)
assert.equal(forbidden.headers.has('set-cookie'), false)

const passwordLogin = await invokeAdminLogin({
  body: { password: 'correct' },
  factory: fakeClientFactory(),
})
assert.equal(passwordLogin.status, 200)
assert.equal(passwordLogin.body.accessToken, 'access-token')
assert.match(passwordLogin.headers.get('set-cookie'), new RegExp(`^${SITE_COOKIE_NAME}=`))

const bearerLogin = await invokeAdminLogin({
  authorization: 'Bearer existing-access-token',
  factory: fakeClientFactory(),
})
assert.equal(bearerLogin.status, 200)
assert.deepEqual(bearerLogin.body, { ok: true })
assert.match(bearerLogin.headers.get('set-cookie'), new RegExp(`^${SITE_COOKIE_NAME}=`))

const expiredBearer = await invokeAdminLogin({
  authorization: 'Bearer expired-access-token',
  factory: fakeClientFactory({ bearerAccepted: false }),
})
assert.equal(expiredBearer.status, 401)
assert.equal(expiredBearer.headers.has('set-cookie'), false)

const membershipFailure = await invokeAdminLogin({
  body: { password: 'correct' },
  factory: fakeClientFactory({ adminError: new Error('database unavailable') }),
})
assert.equal(membershipFailure.status, 500)
assert.equal(membershipFailure.headers.has('set-cookie'), false)

for (const [name, value] of Object.entries(savedEnvironment)) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

console.log('site session verification passed')
