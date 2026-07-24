import { useSyncExternalStore } from 'react'
import {
  addRemoteVideo,
  bulkAddRemote,
  clearRemoteVideos,
  exportRemoteVideos,
  getProjectSnapshot,
  importRemoteVideos,
  removeManyRemote,
  removeRemoteVideo,
  subscribeProject,
  updateRemoteVideo,
  loadRemoteProject,
} from '../data/projectStore.js'

export function useVideos() {
  const project = useSyncExternalStore(subscribeProject, getProjectSnapshot, getProjectSnapshot)
  return {
    videos: project.videos,
    totals: project.totals,
    loading: project.loading,
    error: project.error,
    refetch: () => loadRemoteProject({ force: true }),
    add: addRemoteVideo,
    update: updateRemoteVideo,
    remove: removeRemoteVideo,
    clear: clearRemoteVideos,
    removeMany: removeManyRemote,
    bulkAddRandom: bulkAddRemote,
    importVideos: importRemoteVideos,
    exportToFile: exportRemoteVideos,
  }
}
