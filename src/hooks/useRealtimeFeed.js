import { useEffect, useMemo, useRef, useState } from 'react'
import { hashSeed, seededRng } from '../lib/analyticsEngine.js'

const REALTIME_WINDOW_HOURS = 48
const REALTIME_BUCKET_MS = 60 * 60 * 1000

function sanitizeBars(initial) {
  if (!Array.isArray(initial) || initial.length !== REALTIME_WINDOW_HOURS) {
    return new Array(REALTIME_WINDOW_HOURS).fill(40)
  }
  return initial.map((value) => Math.max(0, Math.round(Number(value) || 0)))
}

function hourlyTarget(seed, bucket, baselineHourly) {
  const rand = seededRng(hashSeed(seed, bucket, 'realtime-hour'))
  const multiplier = 0.72 + rand() * 0.56
  return Math.max(1, Math.round(baselineHourly * multiplier))
}

/**
 * Advances the real 48-hour window without turning every UI refresh into a new hour.
 * The current hour grows only up to a seeded, baseline-relative target, so a long-open
 * tab cannot create an unbounded multiplicative random walk.
 */
export function advanceRealtimeBars(
  previous,
  { seed, bucket, previousBucket, tick, intervalMs, baselineHourly },
) {
  let next = Array.isArray(previous) && previous.length === REALTIME_WINDOW_HOURS
    ? previous
    : sanitizeBars(previous)
  const elapsedBuckets = Math.max(0, Math.floor(bucket - previousBucket))

  if (elapsedBuckets > 0) {
    const steps = Math.min(REALTIME_WINDOW_HOURS, elapsedBuckets)
    const firstNewBucket = bucket - steps + 1
    const appended = []

    for (let index = 0; index < steps; index += 1) {
      const bucketId = firstNewBucket + index
      appended.push(bucketId === bucket ? 0 : hourlyTarget(seed, bucketId, baselineHourly))
    }
    next = [...next.slice(steps), ...appended]
  }

  const currentIndex = next.length - 1
  const currentValue = next[currentIndex]
  const target = hourlyTarget(seed, bucket, baselineHourly)
  const remaining = Math.max(0, target - currentValue)
  if (remaining === 0) return next

  const expectedIncrement = Math.min(remaining, target * (intervalMs / REALTIME_BUCKET_MS))
  const guaranteedIncrement = Math.floor(expectedIncrement)
  const rand = seededRng(hashSeed(seed, bucket, tick, 'realtime-tick'))
  const fractionalIncrement = rand() < expectedIncrement - guaranteedIncrement ? 1 : 0
  const increment = Math.min(remaining, guaranteedIncrement + fractionalIncrement)
  if (increment === 0) return next

  const updated = [...next]
  updated[currentIndex] = currentValue + increment
  return updated
}

/**
 * Realtime feed for 48 hourly buckets. UI refreshes update only the current hour;
 * the array shifts only when an actual clock hour changes.
 */
export function useRealtimeFeed({ initial, seed = 1, intervalMs = 5000 } = {}) {
  const startArr = useMemo(() => sanitizeBars(initial), [initial])
  const inputKey = useMemo(() => `${seed}:${startArr.join('|')}`, [seed, startArr])
  const baselineHourly = useMemo(() => (
    Math.max(1, startArr.reduce((sum, value) => sum + value, 0) / startArr.length)
  ), [startArr])
  const [bars, setBars] = useState(() => startArr)
  const tickRef = useRef(0)
  const intervalRef = useRef(null)
  const hourBucketRef = useRef(null)
  const lastInputKeyRef = useRef(inputKey)

  useEffect(() => {
    if (lastInputKeyRef.current !== inputKey) {
      lastInputKeyRef.current = inputKey
      setBars(startArr)
      tickRef.current = 0
      hourBucketRef.current = Math.floor(Date.now() / REALTIME_BUCKET_MS)
    }
  }, [inputKey, startArr])

  useEffect(() => {
    function tick() {
      const bucket = Math.floor(Date.now() / REALTIME_BUCKET_MS)
      const previousBucket = hourBucketRef.current ?? bucket
      tickRef.current += 1
      setBars((previous) => advanceRealtimeBars(previous, {
        seed,
        bucket,
        previousBucket,
        tick: tickRef.current,
        intervalMs,
        baselineHourly,
      }))
      hourBucketRef.current = bucket
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
  }, [seed, intervalMs, baselineHourly])

  return { bars }
}
