export function buildChannelHandle(channel) {
  const storedHandle = channel.handle || channel.channelHandle || channel.customUrl
  if (storedHandle) return storedHandle.startsWith('@') ? storedHandle : `@${storedHandle}`

  const compactName = String(channel.channelName || 'YouTube')
    .trim()
    .replace(/\s+/g, '_')
  return `@${compactName}`
}

/** Постоянный идентификатор канала (UC… из 24 символов) — из названия канала. */
export function buildChannelId(channel) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  let state = 2166136261
  let id = 'UC'
  const source = String(channel?.channelName || 'YouTube')
  for (let index = 0; id.length < 24; index += 1) {
    state ^= source.charCodeAt(index % source.length) + index
    state = Math.imul(state, 16777619) >>> 0
    id += alphabet[state % alphabet.length]
  }
  return id
}
