import s from './EmptyState.module.css'

export default function EmptyState({ title = 'Недостаточно данных', description, action }) {
  return (
    <div className={s.empty}>
      <div className={s.title}>{title}</div>
      {description ? <div className={s.desc}>{description}</div> : null}
      {action ? <div className={s.action}>{action}</div> : null}
    </div>
  )
}
