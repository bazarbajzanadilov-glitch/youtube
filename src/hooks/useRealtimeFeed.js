import { useEffect, useRef, useState } from 'react'
import { generateRealtimeMinute, hashSeed } from '../lib/analyticsEngine.js'

/**
 * Realtime-фид: 48-баровая скользящая серия. Каждые `intervalMs` сдвигает
 * влево, добавляет новый бар. На скрытой вкладке — пауза без сброса состояния.
 */
export function useRealtimeFeed({ initial, seed = 1, intervalMs = 5000, baseSubscribers = 0 } = {}) {
  const startArr = Array.isArray(initial) && initial.length === 48
    ? initial
    : new Array(48).fill(40)
  const [bars, setBars] = useState(startArr)
  const [subDelta, setSubDelta] = useState(0)
  const tickRef = useRef(0)
  const intervalRef = useRef(null)
  const lastSeedRef = useRef(seed)

  useEffect(() => {
    if (lastSeedRef.current !== seed) {
      lastSeedRef.current = seed
      setBars(startArr)
      setSubDelta(0)
      tickRef.current = 0
    }
  }, [seed, startArr])

  useEffect(() => {
    function tick() {
      setBars((prev) => {
        const last = prev[prev.length - 1]
        tickRef.current += 1
        const next = generateRealtimeMinute(hashSeed(seed, tickRef.current), last)
        return [...prev.slice(1), next]
      })
      setSubDelta((prev) => {
        const dx = Math.round((Math.random() - 0.45) * 4)
        return Math.max(-50, Math.min(200, prev + dx))
      })
    }
    function start() {
      if (intervalRef.current != null) return
      intervalRef.current = setInterval(tick, intervalMs)
    }
    function stop() {
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    function onVis() {
      if (typeof document === 'undefined') return
      if (document.visibilityState === 'visible') start()
      else stop()
    }
    if (typeof document === 'undefined' || document.visibilityState === 'visible') start()
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis)
    return () => {
      stop()
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis)
    }
  }, [seed, intervalMs])

  const liveSubscribers = baseSubscribers + subDelta
  return { bars, liveSubscribers, subDelta }
}
