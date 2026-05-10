import { motion, useReducedMotion } from 'framer-motion'
import s from './FunnelChart.module.css'

/**
 * Воронка — 3 уровня по PDF 22.pdf «Показы значков и время просмотра видео».
 * Каждый шаг — горизонтальная полоса с центральным значением и подписью внизу.
 */
export default function FunnelChart({ steps = [] }) {
  const reduced = useReducedMotion()
  if (steps.length === 0) return null
  const max = steps.reduce((m, x) => Math.max(m, x.value || 0), 0) || 1
  return (
    <div className={s.wrap}>
      {steps.map((step, i) => {
        const widthPct = Math.max(8, (step.value / max) * 100)
        return (
          <div key={`${step.label}-${i}`} className={s.step}>
            <div className={s.bandRow}>
              <motion.div
                className={s.band}
                style={{ width: `${widthPct}%` }}
                initial={reduced ? { width: `${widthPct}%` } : { width: 0, opacity: 0 }}
                animate={{ width: `${widthPct}%`, opacity: 1 }}
                transition={{ duration: 0.65, ease: 'easeOut', delay: i * 0.12 }}
              >
                <div className={s.bandContent}>
                  <span className={s.bandLabel}>{step.label}</span>
                  <span className={s.bandValue}>{step.value}</span>
                </div>
              </motion.div>
            </div>
            {step.note ? <div className={s.stepNote}>{step.note}</div> : null}
          </div>
        )
      })}
    </div>
  )
}
