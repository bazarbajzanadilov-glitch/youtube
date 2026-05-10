import s from './RealtimeIndicator.module.css'

export default function RealtimeIndicator({ live = true, label = 'В реальном времени' }) {
  return (
    <span className={`${s.wrap} ${live ? s.on : s.off}`}>
      <span className={s.dot} />
      <span className={s.label}>{label}</span>
    </span>
  )
}
