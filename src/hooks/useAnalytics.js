import { useEffect, useMemo, useState } from 'react'
import { useVideos } from '../storage/useVideos.js'
import { useChannel } from '../storage/useChannel.js'
import { build } from '../lib/analyticsAggregator.js'
import { getAlmatyDateISO } from '../lib/almatyDate.js'
import { loadRemoteProject } from '../data/projectStore.js'

/**
 * Главный оркестратор аналитики. Принимает текущий range, возвращает
 * мемоизированный агрегат + флаг loading (300мс на первом mount).
 */
export function useAnalytics(range, { enabled = true } = {}) {
  const { videos } = useVideos()
  const { channel } = useChannel()
  const [loading, setLoading] = useState(true)
  const [analyticsDay, setAnalyticsDay] = useState(() => getAlmatyDateISO())

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 300)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!enabled) return undefined
    let currentDay = getAlmatyDateISO()
    const interval = setInterval(() => {
      const nextDay = getAlmatyDateISO()
      if (nextDay === currentDay) return
      currentDay = nextDay
      setAnalyticsDay(nextDay)
      loadRemoteProject({ force: true }).catch(() => {})
    }, 60_000)
    return () => clearInterval(interval)
  }, [enabled])

  const data = useMemo(
    () => (enabled
      ? build(videos, channel, range, {
        today: new Date(`${analyticsDay}T12:00:00+05:00`),
      })
      : null),
    [analyticsDay, enabled, videos, channel, range],
  )

  return data ? { ...data, loading } : null
}
