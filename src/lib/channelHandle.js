export function buildChannelHandle(channel) {
  const storedHandle = channel.handle || channel.channelHandle || channel.customUrl
  if (storedHandle) return storedHandle.startsWith('@') ? storedHandle : `@${storedHandle}`

  const compactName = String(channel.channelName || 'YouTube')
    .trim()
    .replace(/\s+/g, '_')
  return `@${compactName}`
}
