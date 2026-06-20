import { useSyncExternalStore } from 'react'
import { getChannel, updateChannel, replaceChannel, resetChannel, subscribe } from './channelStore.js'

export function useChannel() {
  const channel = useSyncExternalStore(subscribe, getChannel, getChannel)
  return { channel, update: updateChannel, replace: replaceChannel, reset: resetChannel }
}
