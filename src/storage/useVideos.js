import { useSyncExternalStore } from 'react'
import {
  getVideos, getTotals, subscribe,
  addVideo, updateVideo, removeVideo, clearAllVideos,
  removeMany, bulkAddRandom, importVideos, exportToFile, resetToBundled,
} from './videoStore.js'

export function useVideos() {
  const videos = useSyncExternalStore(subscribe, getVideos, getVideos)
  const totals = useSyncExternalStore(subscribe, getTotals, getTotals)
  return {
    videos, totals,
    add: addVideo, update: updateVideo,
    remove: removeVideo, clear: clearAllVideos,
    removeMany, bulkAddRandom, importVideos, exportToFile, resetToBundled,
  }
}
