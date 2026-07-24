import assert from 'node:assert/strict'
import {
  createSiteSession,
  passwordsMatch,
  readCookie,
  SITE_COOKIE_NAME,
  SITE_SESSION_MAX_AGE,
  siteCookie,
  verifySiteSession,
} from '../server/siteSession.js'
import {
  hashPassword,
  verifyPasswordHash,
} from '../server/passwordHash.js'

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

console.log('site session verification passed')
