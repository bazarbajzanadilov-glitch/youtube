import { useEffect, useMemo, useState } from 'react'
import { useVideos } from '../storage/useVideos.js'
import { useChannel } from '../storage/useChannel.js'
import { build } from '../lib/analyticsAggregator.js'

/**
 * Главный оркестратор аналитики. Принимает текущий range, возвращает
 * мемоизированный агрегат + флаг loading (300мс на первом mount).
 */
export function useAnalytics(range) {
  const { videos } = useVideos()
  const { channel } = useChannel()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 300)
    return () => clearTimeout(t)
  }, [])

  const data = useMemo(
    () => build(videos, channel, range),
    [videos, channel, range?.kind, range?.from, range?.to],
  )

  return { ...data, loading }
}
