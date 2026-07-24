import s from './ChartTooltip.module.css'
import { formatChartDateLabel } from '../../lib/chartDateFormat.js'

function pickTooltipAccentColor(payloadItem) {
  const candidates = [
    payloadItem?.stroke,
    payloadItem?.color,
    payloadItem?.payload?.color,
    payloadItem?.fill,
  ]

  return candidates.find((candidate) => (
    typeof candidate === 'string'
    && candidate.trim() !== ''
    && candidate.trim() !== 'none'
    && candidate.trim() !== 'transparent'
    && candidate.trim() !== 'initial'
    && candidate.trim() !== 'inherit'
    && candidate.trim() !== 'unset'
    && !candidate.trim().startsWith('url(')
  )) || null
}

export default function ChartTooltip({
  active,
  payload,
  label,
  formatLabel,
  formatValue,
  valueSuffix = '',
  className = '',
  labelClassName = '',
  valueClassName = '',
  rawValueKey,
  detailRows,
}) {
  if (!active || !payload || payload.length === 0) return null

  const first = payload[0]
  const lbl = (formatLabel ? formatLabel(label) : formatChartDateLabel(label)) || first.name || first.dataKey
  const numericValues = payload
    .map((p) => Number(p.value ?? p.payload?.[p.dataKey]))
    .filter((value) => Number.isFinite(value))
  const raw = rawValueKey && first.payload
    ? first.payload[rawValueKey]
    : payload.length > 1 && numericValues.length > 0
    ? numericValues.reduce((sum, value) => sum + value, 0)
    : (first.value ?? first.payload?.[first.dataKey])
  const formatted = raw == null ? '' : (formatValue ? formatValue(raw, first) : String(raw))
  const accentColor = pickTooltipAccentColor(first)
  const rows = typeof detailRows === 'function'
    ? detailRows(first.payload || {}, first)
    : []

  return (
    <div
      className={[s.tip, className].filter(Boolean).join(' ')}
      style={accentColor ? { '--chart-tooltip-accent': accentColor } : undefined}
    >
      {lbl ? <div className={[s.label, labelClassName].filter(Boolean).join(' ')}>{lbl}</div> : null}
      {rows.length > 0 ? (
        <div className={s.details}>
          {rows.map((row) => (
            <div className={[s.detailRow, row.emphasis ? s.detailEmphasis : ''].filter(Boolean).join(' ')} key={row.label}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
      ) : (
        <div className={[s.value, valueClassName].filter(Boolean).join(' ')}>{formatted}{valueSuffix}</div>
      )}
    </div>
  )
}
