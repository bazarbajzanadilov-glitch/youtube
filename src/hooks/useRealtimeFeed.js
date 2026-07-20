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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function advanceSubscriberOffset(previous, { seed, tick }) {
  const current = clamp(Math.round(Number(previous) || 0), -1, 2)
  if (tick % 2 !== 0) return current
  if (current <= -1) return current + 1
  if (current >= 2) return current - 1

  const rand = seededRng(hashSeed(seed, tick, 'realtime-subscribers'))
  const upwardChance = current > 0 ? 0.38 : current < 0 ? 0.68 : 0.55
  return current + (rand() < upwardChance ? 1 : -1)
}

/**
 * Advances the real 48-hour window without turning every UI refresh into a new hour.
 * The current hour grows only up to a seeded, baseline-relative target, so a long-open
 * tab cannot create an unbounded multiplicative random walk.
 */
export function advanceRealtimeBars(
  previous,
  { seed, bucket, previousBucket, tick, baselineHourly },
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
  const spread = Math.max(3, Math.round(baselineHourly * 0.45))
  const minValue = Math.max(0, Math.round(baselineHourly - spread))
  const maxValue = Math.max(minValue + 2, Math.round(baselineHourly + spread))
  const rand = seededRng(hashSeed(seed, bucket, tick, 'realtime-tick'))
  let direction

  if (currentValue <= minValue) direction = 1
  else if (currentValue >= maxValue) direction = -1
  else {
    const targetBias = clamp((target - currentValue) / Math.max(1, spread), -1, 1) * 0.22
    direction = rand() < 0.5 + targetBias ? 1 : -1
  }

  const updated = [...next]
  updated[currentIndex] = clamp(currentValue + direction, minValue, maxValue)
  return updated
}

/**
 * Realtime feed for 48 hourly buckets. UI refreshes update only the current hour;
 * the array shifts only when an actual clock hour changes.
 */
export function useRealtimeFeed({ initial, seed = 1, intervalMs = 5000, baseSubscribers = 0 } = {}) {
  const startArr = useMemo(() => sanitizeBars(initial), [initial])
  const baseSubscriberCount = Math.max(0, Math.round(Number(baseSubscribers) || 0))
  const inputKey = useMemo(
    () => `${seed}:${baseSubscriberCount}:${startArr.join('|')}`,
    [seed, baseSubscriberCount, startArr],
  )
  const baselineHourly = useMemo(() => (
    Math.max(1, startArr.reduce((sum, value) => sum + value, 0) / startArr.length)
  ), [startArr])
  const [bars, setBars] = useState(() => startArr)
  const [subscriberOffset, setSubscriberOffset] = useState(0)
  const tickRef = useRef(0)
  const intervalRef = useRef(null)
  const hourBucketRef = useRef(null)
  const lastInputKeyRef = useRef(inputKey)

  useEffect(() => {
    if (lastInputKeyRef.current !== inputKey) {
      lastInputKeyRef.current = inputKey
      setBars(startArr)
      setSubscriberOffset(0)
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
        baselineHourly,
      }))
      setSubscriberOffset((previous) => advanceSubscriberOffset(previous, {
        seed,
        tick: tickRef.current,
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

  return {
    bars,
    subDelta: subscriberOffset,
    liveSubscribers: Math.max(0, baseSubscriberCount + subscriberOffset),
  }
}
