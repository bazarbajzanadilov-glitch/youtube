import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const HASH_BYTES = 64
const PREFIX = 'scrypt'

function safeEqual(left, right) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString('base64url')
  const hash = scryptSync(String(password), salt, HASH_BYTES).toString('base64url')
  return `${PREFIX}$${salt}$${hash}`
}

export function verifyPasswordHash(password, encodedHash) {
  const [prefix, salt, expectedHash] = String(encodedHash || '').split('$')
  if (prefix !== PREFIX || !salt || !expectedHash) return false

  try {
    const actualHash = scryptSync(String(password), salt, HASH_BYTES).toString('base64url')
    return safeEqual(actualHash, expectedHash)
  } catch {
    return false
  }
}
