import s from './DeltaChip.module.css'

export default function DeltaChip({ value = 0, suffix = '%', neutralThreshold = 0.05, label }) {
  const num = Number(value) || 0
  const positive = num > neutralThreshold
  const negative = num < -neutralThreshold
  const cls = positive ? s.positive : negative ? s.negative : s.neutral
  const display = `${positive ? '+' : ''}${num.toFixed(1).replace('.', ',')}${suffix}`
  return (
    <span className={`${s.chip} ${cls}`} title={label}>
      <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
        {positive
          ? <path d="M6 2 L10 8 L2 8 Z" fill="currentColor" />
          : negative
            ? <path d="M6 10 L10 4 L2 4 Z" fill="currentColor" />
            : <circle cx="6" cy="6" r="2.5" fill="currentColor" />}
      </svg>
      {display}
    </span>
  )
}
