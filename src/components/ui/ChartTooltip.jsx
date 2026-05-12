import s from './ChartTooltip.module.css'
import { formatChartDateLabel } from '../../lib/chartDateFormat.js'

export default function ChartTooltip({ active, payload, label, formatLabel, formatValue, valueSuffix = '' }) {
  if (!active || !payload || payload.length === 0) return null

  const first = payload[0]
  const lbl = (formatLabel ? formatLabel(label) : formatChartDateLabel(label)) || first.name || first.dataKey
  const numericValues = payload
    .map((p) => Number(p.value ?? p.payload?.[p.dataKey]))
    .filter((value) => Number.isFinite(value))
  const raw = payload.length > 1 && numericValues.length > 0
    ? numericValues.reduce((sum, value) => sum + value, 0)
    : (first.value ?? first.payload?.[first.dataKey])
  const formatted = raw == null ? '' : (formatValue ? formatValue(raw, first) : String(raw))

  return (
    <div className={s.tip}>
      {lbl ? <div className={s.label}>{lbl}</div> : null}
      <div className={s.value}>{formatted}{valueSuffix}</div>
    </div>
  )
}
