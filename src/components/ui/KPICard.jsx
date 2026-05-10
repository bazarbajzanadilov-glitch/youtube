import { motion } from 'framer-motion'
import s from './KPICard.module.css'
import AnimatedCounter from './AnimatedCounter.jsx'
import DeltaChip from './DeltaChip.jsx'
import Skeleton from './Skeleton.jsx'

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

export default function KPICard({
  label,
  value,
  delta,
  format = (x) => Math.round(x).toLocaleString('ru-RU'),
  suffix,
  prefix,
  hint,
  loading = false,
  highlighted = false,
  variants,
}) {
  return (
    <motion.div className={`${s.card} ${highlighted ? s.highlighted : ''}`} variants={variants || cardVariants}>
      <div className={s.label}>{label}</div>
      <div className={s.valueRow}>
        {loading ? (
          <Skeleton width={96} height={28} radius={6} />
        ) : (
          <span className={s.value}>
            {prefix ? <span className={s.affix}>{prefix}</span> : null}
            <AnimatedCounter value={Number(value) || 0} format={format} />
            {suffix ? <span className={s.affix}>{suffix}</span> : null}
          </span>
        )}
      </div>
      <div className={s.metaRow}>
        {loading ? (
          <Skeleton width={56} height={14} radius={4} />
        ) : (
          <>
            {Number.isFinite(delta) ? <DeltaChip value={delta} /> : null}
            {hint ? <span className={s.hint}>{hint}</span> : null}
          </>
        )}
      </div>
    </motion.div>
  )
}
