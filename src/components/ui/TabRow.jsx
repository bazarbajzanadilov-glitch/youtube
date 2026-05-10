import { motion } from 'framer-motion'
import s from './TabRow.module.css'

/**
 * Подчёркивающие пилюлевые табы. Active-индикатор плавно перелетает через
 * framer-motion layoutId. Сохраняет существующий стиль скрина (border-bottom).
 */
export default function TabRow({ tabs = [], active = 0, onChange = () => {}, layoutId = 'tab-underline', className = '' }) {
  return (
    <div className={`${s.row} ${className}`} role="tablist">
      {tabs.map((label, i) => (
        <button
          key={`${label}-${i}`}
          role="tab"
          type="button"
          aria-selected={i === active}
          className={`${s.tab} ${i === active ? s.active : ''}`}
          onClick={() => onChange(i)}
        >
          <span className={s.label}>{label}</span>
          {i === active ? (
            <motion.span
              layoutId={layoutId}
              className={s.indicator}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          ) : null}
        </button>
      ))}
    </div>
  )
}
