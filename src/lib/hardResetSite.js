const RESET_PASS_PARAM = '__ytHardResetPass'
const RESET_BUST_PARAM = '__ytHardResetBust'

async function clearCacheStorage() {
  if (!('caches' in window)) return
  const keys = await window.caches.keys()
  await Promise.all(keys.map((key) => window.caches.delete(key)))
}

async function unregisterServiceWorkers() {
  if (!('serviceWorker' in navigator)) return
  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(registrations.map((registration) => registration.unregister()))
}

export async function clearSiteCache() {
  await Promise.allSettled([
    clearCacheStorage(),
    unregisterServiceWorkers(),
  ])
}

export async function beginDoubleHardReset() {
  await clearSiteCache()
  const url = new URL(window.location.href)
  url.searchParams.set(RESET_PASS_PARAM, '1')
  url.searchParams.set(RESET_BUST_PARAM, String(Date.now()))
  window.location.replace(url.toString())
}

export async function continueDoubleHardResetIfNeeded() {
  const url = new URL(window.location.href)
  if (url.searchParams.get(RESET_PASS_PARAM) !== '1') return false

  await clearSiteCache()
  url.searchParams.delete(RESET_PASS_PARAM)
  url.searchParams.delete(RESET_BUST_PARAM)
  window.location.replace(url.toString())
  return true
}
