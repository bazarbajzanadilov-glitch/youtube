import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

/**
 * Tween числа от старого значения к новому. Работает с любым форматтером.
 * Использует RAF; уважает prefers-reduced-motion.
 */
export default function AnimatedCounter({ value = 0, duration = 850, format = (x) => String(Math.round(x)) }) {
  const reduced = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const startRef = useRef(0)
  const rafRef = useRef(0)

  useEffect(() => {
    if (reduced || duration <= 0) {
      setDisplay(value)
      fromRef.current = value
      return
    }
    const from = fromRef.current
    const to = value
    if (from === to) return
    startRef.current = performance.now()
    cancelAnimationFrame(rafRef.current)
    function step(now) {
      const elapsed = now - startRef.current
      const t = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const current = from + (to - from) * eased
      setDisplay(current)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        fromRef.current = to
      }
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration, reduced])

  return <>{format(display)}</>
}
