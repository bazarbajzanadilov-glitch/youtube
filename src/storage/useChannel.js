import { useSyncExternalStore } from 'react'
import { getChannel, updateChannel, resetChannel, subscribe } from './channelStore.js'

export function useChannel() {
  const channel = useSyncExternalStore(subscribe, getChannel, getChannel)
  return { channel, update: updateChannel, reset: resetChannel }
}
