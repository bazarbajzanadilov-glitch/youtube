import { motion, useReducedMotion } from 'framer-motion'
import s from './RealtimeMiniChart.module.css'
import { CHART_COLORS } from '../../lib/chartColors.js'

/**
 * 48-баровая realtime-полоса. Каждый бар = 1 час. Последний — «сейчас» (анимирован).
 */
export default function RealtimeMiniChart({
  bars = [],
  height = 70,
  color = CHART_COLORS.primary,
  hint = (i, total) => `${total - i - 1}ч назад`,
  formatValue = (v) => Number(v).toLocaleString('ru-RU'),
}) {
  const reduced = useReducedMotion()
  if (bars.length === 0) return null
  const max = Math.max(...bars, 1)
  return (
    <div className={s.wrap} style={{ height }}>
      <div className={s.bars} role="img" aria-label="Просмотры за последние 48 часов">
        {bars.map((v, i) => {
          const isLast = i === bars.length - 1
          return (
            <motion.span
              key={`${i}-${v}`}
              className={`${s.bar} ${isLast ? s.barLast : ''}`}
              style={{ background: color }}
              initial={reduced
                ? { height: `${(v / max) * 100}%` }
                : (isLast ? { height: 0, opacity: 0 } : { height: `${(v / max) * 100}%` })}
              animate={{ height: `${(v / max) * 100}%`, opacity: 1 }}
              transition={isLast ? { duration: 0.4, ease: 'easeOut' } : { duration: 0 }}
              title={`${hint(i, bars.length)} · ${formatValue(v)}`}
            />
          )
        })}
      </div>
      <div className={s.scaleRow}>
        <span>−48ч</span>
        <span>−24ч</span>
        <span>сейчас</span>
      </div>
    </div>
  )
}
