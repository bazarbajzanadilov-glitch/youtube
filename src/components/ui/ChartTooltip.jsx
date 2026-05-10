import s from './ChartTooltip.module.css'

/**
 * Рендерит карточку при hover на чарте Recharts. Передаётся в Tooltip как `content={...}`.
 */
export default function ChartTooltip({ active, payload, label, formatLabel, formatValue, valueSuffix = '' }) {
  if (!active || !payload || payload.length === 0) return null
  const lbl = formatLabel ? formatLabel(label) : label
  return (
    <div className={s.tip}>
      {lbl ? <div className={s.label}>{lbl}</div> : null}
      <div className={s.rows}>
        {payload.map((p, i) => {
          const val = p.value ?? p.payload?.[p.dataKey]
          const formatted = formatValue ? formatValue(val, p) : String(val)
          return (
            <div key={`${p.dataKey || p.name}-${i}`} className={s.row}>
              <span className={s.swatch} style={{ background: p.color || p.stroke || p.fill }} />
              <span className={s.name}>{p.name || p.dataKey}</span>
              <span className={s.value}>{formatted}{valueSuffix}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
