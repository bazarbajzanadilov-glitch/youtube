import { useSyncExternalStore } from 'react'
import {
  getProjectSnapshot,
  loadRemoteProject,
  replaceRemoteProject,
  saveRemoteChannel,
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
    replace: replaceRemoteProject,
  }
}
