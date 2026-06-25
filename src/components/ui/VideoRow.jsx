import s from './VideoRow.module.css'

export default function VideoRow({
  as = 'div',
  type = 'button',
  className = '',
  thumbClassName = '',
  bodyClassName = '',
  titleClassName = '',
  metaClassName = '',
  blankClassName = '',
  title,
  cover,
  meta,
  trailing,
  children,
  ...rest
}) {
  const Tag = as

  return (
    <Tag
      className={[s.row, className].filter(Boolean).join(' ')}
      type={Tag === 'button' ? type : undefined}
      data-studio-video-row="true"
      {...rest}
    >
      <span className={[s.thumb, thumbClassName].filter(Boolean).join(' ')}>
        {cover ? <img src={cover} alt="" /> : <span className={[s.thumbBlank, blankClassName].filter(Boolean).join(' ')} />}
      </span>
      <span className={[s.body, bodyClassName].filter(Boolean).join(' ')}>
        <span className={[s.title, titleClassName].filter(Boolean).join(' ')}>{title}</span>
        {meta ? <span className={[s.meta, metaClassName].filter(Boolean).join(' ')}>{meta}</span> : null}
        {children}
      </span>
      {trailing}
    </Tag>
  )
}
