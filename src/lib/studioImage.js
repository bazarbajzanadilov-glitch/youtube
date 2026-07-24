export const MAX_SOURCE_IMAGE_BYTES = 2 * 1024 * 1024
export const MAX_STORED_IMAGE_BYTES = 200 * 1024
export const STUDIO_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'

const SOURCE_IMAGE_TYPES = new Set(STUDIO_IMAGE_ACCEPT.split(','))
const MAX_SOURCE_PIXELS = 32_000_000
const WEBP_QUALITIES = [0.82, 0.72, 0.62, 0.52, 0.44]

const IMAGE_BOUNDS = {
  cover: { width: 1280, height: 720 },
  avatar: { width: 512, height: 512 },
}

export function formatImageBytes(bytes) {
  const value = Math.max(0, Number(bytes) || 0)
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1).replace('.', ',')} МБ`
  return `${Math.max(1, Math.round(value / 1024))} КБ`
}

export function validateStudioImageSource(file) {
  if (!file || typeof file.size !== 'number') {
    throw new Error('Выберите изображение')
  }
  if (file.size <= 0) {
    throw new Error('Файл изображения пуст')
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error(`Изображение больше ${formatImageBytes(MAX_SOURCE_IMAGE_BYTES)}. Выберите файл меньшего размера.`)
  }
  if (!SOURCE_IMAGE_TYPES.has(String(file.type || '').toLowerCase())) {
    throw new Error('Поддерживаются только JPEG, PNG и WebP')
  }
}

export function validatePreparedStudioImage(file) {
  if (!file || String(file.type || '').toLowerCase() !== 'image/webp') {
    throw new Error('Изображение должно быть подготовлено в формате WebP')
  }
  if (file.size <= 0 || file.size > MAX_STORED_IMAGE_BYTES) {
    throw new Error(`Готовое изображение должно быть не больше ${formatImageBytes(MAX_STORED_IMAGE_BYTES)}`)
  }
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Браузер не смог преобразовать изображение в WebP'))
      },
      'image/webp',
      quality,
    )
  })
}

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw(context, width, height) {
        context.drawImage(bitmap, 0, 0, width, height)
      },
      close() {
        bitmap.close()
      },
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    await image.decode()
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      draw(context, width, height) {
        context.drawImage(image, 0, 0, width, height)
      },
      close() {},
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function outputName(file) {
  const base = String(file.name || 'studio-image')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'studio-image'
  return `${base}.webp`
}

export async function prepareStudioImage(file, kind = 'cover') {
  validateStudioImageSource(file)
  const bounds = IMAGE_BOUNDS[kind] || IMAGE_BOUNDS.cover
  let decoded

  try {
    decoded = await decodeImage(file)
    if (!decoded.width || !decoded.height) throw new Error('Не удалось определить размер изображения')
    if (decoded.width * decoded.height > MAX_SOURCE_PIXELS) {
      throw new Error('Слишком большое разрешение изображения')
    }

    const initialScale = Math.min(1, bounds.width / decoded.width, bounds.height / decoded.height)
    let scale = initialScale
    let lastBlob = null

    for (let sizeAttempt = 0; sizeAttempt < 5; sizeAttempt += 1) {
      const width = Math.max(1, Math.round(decoded.width * scale))
      const height = Math.max(1, Math.round(decoded.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d', { alpha: true })
      if (!context) throw new Error('Браузер не поддерживает обработку изображений')

      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      decoded.draw(context, width, height)

      for (const quality of WEBP_QUALITIES) {
        lastBlob = await canvasToBlob(canvas, quality)
        if (lastBlob.size <= MAX_STORED_IMAGE_BYTES) {
          const prepared = new File([lastBlob], outputName(file), {
            type: 'image/webp',
            lastModified: Date.now(),
          })
          validatePreparedStudioImage(prepared)
          return {
            file: prepared,
            originalBytes: file.size,
            outputBytes: prepared.size,
            width,
            height,
          }
        }
      }

      scale *= 0.78
    }

    throw new Error(
      `Не удалось сжать изображение до ${formatImageBytes(MAX_STORED_IMAGE_BYTES)}`
      + (lastBlob ? ` (получилось ${formatImageBytes(lastBlob.size)})` : ''),
    )
  } catch (error) {
    if (error instanceof Error) throw error
    throw new Error('Не удалось обработать изображение', { cause: error })
  } finally {
    decoded?.close()
  }
}
