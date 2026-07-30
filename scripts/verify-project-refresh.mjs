import assert from 'node:assert/strict'

const eventListeners = new Map()
let intervalCallback = null
let remoteRevision = 'revision-1'
let fullLoads = 0
let revisionLoads = 0

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  },
})

globalThis.document = {
  visibilityState: 'visible',
  addEventListener(type, callback) {
    eventListeners.set(`document:${type}`, callback)
  },
}

globalThis.window = {
  setInterval(callback) {
    intervalCallback = callback
    return 1
  },
  addEventListener(type, callback) {
    eventListeners.set(`window:${type}`, callback)
  },
}

globalThis.fetch = async (url) => {
  const isRevisionRequest = String(url).includes('revision=1')
  if (isRevisionRequest) revisionLoads += 1
  else fullLoads += 1

  const body = isRevisionRequest
    ? { revision: remoteRevision }
    : {
      revision: remoteRevision,
      videos: [],
      channel: { channelName: 'Test channel' },
      videoDailyStats: [{
        videoId: 'video-1',
        date: '2026-07-29',
        views: fullLoads,
      }],
    }

  return {
    ok: true,
    json: async () => body,
  }
}

async function flushPromises() {
  await new Promise((resolve) => setImmediate(resolve))
  await new Promise((resolve) => setImmediate(resolve))
}

const { createServer } = await import('vite')
const vite = await createServer({
  configFile: false,
  envDir: false,
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'spa',
})

try {
  const store = await vite.ssrLoadModule('/src/data/projectStore.js')
  await store.loadRemoteProject()

  assert.equal(store.getProjectSnapshot().revision, 'revision-1')
  assert.equal(store.getChannelSnapshot().videoDailyStats[0].views, 1)
  assert.equal(typeof intervalCallback, 'function')

  eventListeners.get('window:focus')()
  await flushPromises()
  assert.equal(fullLoads, 1)
  assert.equal(revisionLoads, 1)

  remoteRevision = 'revision-2'
  eventListeners.get('document:visibilitychange')()
  await flushPromises()
  assert.equal(fullLoads, 2)
  assert.equal(store.getProjectSnapshot().revision, 'revision-2')

  document.visibilityState = 'hidden'
  remoteRevision = 'revision-3'
  intervalCallback()
  eventListeners.get('window:focus')()
  await flushPromises()
  assert.equal(fullLoads, 2)
  assert.equal(revisionLoads, 2)

  console.log('project refresh verification passed')
} finally {
  await vite.close()
}
