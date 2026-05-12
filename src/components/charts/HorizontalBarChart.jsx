import { motion, useReducedMotion } from 'framer-motion'
import s from './HorizontalBarChart.module.css'
import { CHART_COLORS } from '../../lib/chartColors.js'
import { CHART_ANIMATION_SECONDS } from './chartAnimation.js'

/**
 * Горизонтальные бары с inline-процентами. Сделано без Recharts —
 * проще управлять анимацией ширины, текстом, hover.
 */
export default function HorizontalBarChart({
  data = [],
  defaultColor = CHART_COLORS.primary,
  formatValue = (v) => `${(v * 100).toFixed(1).replace('.', ',')} %`,
  showAmount = false,
  formatAmount = (n) => Number(n).toLocaleString('ru-RU'),
}) {
  const reduced = useReducedMotion()
  if (data.length === 0) return null
  const max = data.reduce((m, x) => Math.max(m, x.share || x.value || 0), 0) || 1

  return (
    <ul className={s.list}>
      {data.map((row, i) => {
        const value = row.share ?? row.value ?? 0
        const pct = (value / max) * 100
        const color = row.color || defaultColor
        return (
          <li key={`${row.label}-${i}`} className={s.row}>
            <span className={s.label} title={row.label}>{row.label}</span>
            <span className={s.barWrap}>
              <motion.span
                className={s.bar}
                style={{ background: color }}
                initial={reduced ? { width: `${pct}%` } : { width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: CHART_ANIMATION_SECONDS, ease: 'easeOut', delay: i * 0.04 }}
              />
            </span>
            <span className={s.value}>{formatValue(value)}</span>
            {showAmount ? <span className={s.amount}>{formatAmount(row.amount ?? value)}</span> : null}
          </li>
        )
      })}
    </ul>
  )
}
