import { motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'
import s from './Heatmap7x24.module.css'
import { HEATMAP_RAMP } from '../../lib/chartColors.js'

const DAY_LABELS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']
const HOUR_LABELS = ['00:00','06:00','12:00','18:00']

function pickColor(intensity) {
  if (intensity <= 0.001) return 'rgba(255,255,255,0.025)'
  const idx = Math.min(HEATMAP_RAMP.length - 1, Math.floor(intensity * HEATMAP_RAMP.length))
  return HEATMAP_RAMP[idx]
}

/**
 * matrix[7][24] значений 0..1.
 * matrix[0] — понедельник.
 */
export default function Heatmap7x24({ matrix = [] }) {
  const reduced = useReducedMotion()
  const [hover, setHover] = useState(null)

  if (matrix.length === 0) return null

  return (
    <div className={s.wrap}>
      <div className={s.scrollX}>
        <div className={s.grid}>
          <div className={s.cornerCell} />
          <div className={s.hourScale} aria-hidden="true">
            {HOUR_LABELS.map((h) => <span key={h} className={s.hourLabel}>{h}</span>)}
          </div>

          {matrix.map((row, dayIdx) => (
            <div key={dayIdx} className={s.dayRow}>
              <span className={s.dayLabel}>{DAY_LABELS[dayIdx]}</span>
              <div className={s.cells}>
                {row.map((value, hourIdx) => {
                  const isHover = hover && hover.day === dayIdx && hover.hour === hourIdx
                  return (
                    <motion.span
                      key={`${dayIdx}-${hourIdx}`}
                      className={`${s.cell} ${isHover ? s.cellHover : ''}`}
                      style={{ background: pickColor(value) }}
                      initial={reduced ? { opacity: 1 } : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: (dayIdx * 24 + hourIdx) * 0.0024, duration: 0.22 }}
                      onMouseEnter={() => setHover({ day: dayIdx, hour: hourIdx, value })}
                      onMouseLeave={() => setHover(null)}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className={s.legendRow}>
        <span className={s.legendLabel}>Меньше</span>
        <div className={s.legendBar}>
          {HEATMAP_RAMP.map((c, i) => <span key={i} className={s.legendCell} style={{ background: c }} />)}
        </div>
        <span className={s.legendLabel}>Больше</span>
        {hover ? (
          <span className={s.tooltip}>
            {DAY_LABELS[hover.day]}, {String(hover.hour).padStart(2, '0')}:00–{String(hover.hour + 1).padStart(2, '0')}:00
            · {(hover.value * 100).toFixed(0)}%
          </span>
        ) : null}
      </div>
    </div>
  )
}
