import assert from 'node:assert/strict'
import {
  MAX_SOURCE_IMAGE_BYTES,
  MAX_STORED_IMAGE_BYTES,
  STUDIO_IMAGE_ACCEPT,
  validatePreparedStudioImage,
  validateStudioImageSource,
} from '../src/lib/studioImage.js'

assert.equal(MAX_SOURCE_IMAGE_BYTES, 2 * 1024 * 1024)
assert.equal(MAX_STORED_IMAGE_BYTES, 200 * 1024)
assert.equal(STUDIO_IMAGE_ACCEPT, 'image/jpeg,image/png,image/webp')

assert.doesNotThrow(() => validateStudioImageSource({
  name: 'cover.png',
  size: MAX_SOURCE_IMAGE_BYTES,
  type: 'image/png',
}))

assert.throws(
  () => validateStudioImageSource({
    name: 'oversized.png',
    size: MAX_SOURCE_IMAGE_BYTES + 1,
    type: 'image/png',
  }),
  /2,0 МБ|2 МБ/,
)

assert.throws(
  () => validateStudioImageSource({
    name: 'unsafe.svg',
    size: 1024,
    type: 'image/svg+xml',
  }),
  /JPEG, PNG и WebP/,
)

assert.doesNotThrow(() => validatePreparedStudioImage({
  name: 'cover.webp',
  size: MAX_STORED_IMAGE_BYTES,
  type: 'image/webp',
}))

assert.throws(
  () => validatePreparedStudioImage({
    name: 'cover.webp',
    size: MAX_STORED_IMAGE_BYTES + 1,
    type: 'image/webp',
  }),
  /200 КБ/,
)

assert.throws(
  () => validatePreparedStudioImage({
    name: 'cover.png',
    size: 100 * 1024,
    type: 'image/png',
  }),
  /WebP/,
)

console.log('studio image policy verification passed')
