import { useMemo } from 'react'

const REALTIME_WINDOW_HOURS = 48

function sanitizeBars(initial) {
  if (!Array.isArray(initial) || initial.length !== REALTIME_WINDOW_HOURS) {
    return new Array(REALTIME_WINDOW_HOURS).fill(0)
  }
  return initial.map((value) => Math.max(0, Math.round(Number(value) || 0)))
}

/**
 * Stable 48-hour snapshot. It changes only when the Supabase-backed analytics
 * input changes, never because another analytics range was selected.
 */
export function useRealtimeFeed({ initial, baseSubscribers = 0 } = {}) {
  const startArr = useMemo(() => sanitizeBars(initial), [initial])
  const baseSubscriberCount = Math.max(0, Math.round(Number(baseSubscribers) || 0))

  return {
    bars: startArr,
    subDelta: 0,
    liveSubscribers: baseSubscriberCount,
  }
}
