import { useEffect, useState } from 'react'

/**
 * Возвращает `true` после следующего frame после mount.
 * Используем перед монтированием Recharts ResponsiveContainer чтобы избежать
 * warning'а «width(-1) and height(-1)» при первом измерении внутри AnimatePresence.
 */
export function useDeferredMount() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (typeof requestAnimationFrame !== 'undefined') {
      const id = requestAnimationFrame(() => setReady(true))
      return () => cancelAnimationFrame(id)
    }
    setReady(true)
    return undefined
  }, [])
  return ready
}
