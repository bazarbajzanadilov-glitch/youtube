import { useSyncExternalStore } from 'react'
import {
  getProjectSnapshot,
  loadRemoteProject,
  replaceRemoteProject,
  saveRemoteChannel,
  saveRemoteSubscriberDailyStats,
  subscribeProject,
} from '../data/projectStore.js'

export function useChannel() {
  const project = useSyncExternalStore(subscribeProject, getProjectSnapshot, getProjectSnapshot)
  return {
    channel: project.channel,
    loading: project.loading,
    error: project.error,
    refetch: () => loadRemoteProject({ force: true }),
    update: saveRemoteChannel,
    updateSubscriberDailyStats: saveRemoteSubscriberDailyStats,
    replace: replaceRemoteProject,
  }
}
