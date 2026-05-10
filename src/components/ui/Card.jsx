import s from './Card.module.css'

export default function Card({ children, className = '', depth = 'md', padding = 'md', as = 'div', ...rest }) {
  const Tag = as
  const cls = [s.card, s[`depth-${depth}`], s[`pad-${padding}`], className].filter(Boolean).join(' ')
  return (
    <Tag className={cls} {...rest}>
      {children}
    </Tag>
  )
}
