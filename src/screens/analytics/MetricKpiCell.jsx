import clockIcon from '../../assets/clock.svg'
import { KpiDownCircleIcon, KpiUpCircleIcon } from '../icons.jsx'
import s from './AnalyticsTabs.module.css'

export default function MetricKpiCell({
  label,
  value,
  note,
  active = false,
  clock = false,
  trend = 'neutral',
  onClick,
  accentColor,
  className = '',
}) {
  const Tag = onClick ? 'button' : 'div'
  const showTrend = trend === 'up' || trend === 'down'

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      aria-pressed={onClick ? active : undefined}
      className={`${s.ytKpiCell} ${active ? s.ytKpiCellActive : ''} ${className}`}
      onClick={onClick}
      style={active && accentColor ? { '--yt-kpi-accent': accentColor } : undefined}
    >
      <div className={s.ytKpiLabel}>
        {label}
        {clock ? <img className={s.clockBadge} src={clockIcon} alt="" aria-hidden="true" /> : null}
      </div>
      <div className={s.ytKpiValue}>
        {value}
        {showTrend ? (
          <span className={`${s.trendMark} ${trend === 'up' ? s.trendUp : s.trendDown}`}>
            {trend === 'up'
              ? <KpiUpCircleIcon size={18} color="#2ba640" />
              : <KpiDownCircleIcon size={18} color="#909090" />}
          </span>
        ) : null}
      </div>
      {note ? <div className={s.ytKpiNote}>{note}</div> : null}
    </Tag>
  )
}
