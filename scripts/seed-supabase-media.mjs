import { readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const supabaseUrl = process.env.VITE_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !secretKey) {
  throw new Error('VITE_SUPABASE_URL and SUPABASE_SECRET_KEY are required')
}

const channelId = '00000000-0000-0000-0000-000000000001'
const media = [
  ['studio-assets/trading-avatar.svg', `channels/${channelId}/avatar/trading-avatar.svg`],
  ...[1, 2, 3, 4].map((number) => [
    `studio-assets/trading-thumb-${number}.svg`,
    `channels/${channelId}/videos/seed/trading-thumb-${number}.svg`,
  ]),
]

const contentTypes = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

for (const [source, destination] of media) {
  const body = await readFile(resolve(projectRoot, 'public', source))
  const { error } = await supabase.storage
    .from('studio-media')
    .upload(destination, body, {
      contentType: contentTypes[extname(source).toLowerCase()] || 'application/octet-stream',
      cacheControl: '3600',
      upsert: true,
    })
  if (error) throw error
  console.log(`Uploaded ${source}`)
}
