import s from './StudioButton.module.css'

export default function StudioButton({
  as = 'button',
  type = 'button',
  variant = 'pill',
  size = 'md',
  active = false,
  className = '',
  children,
  ...rest
}) {
  const Tag = as
  const cls = [
    s.button,
    s[`variant-${variant}`],
    s[`size-${size}`],
    active ? s.active : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <Tag
      className={cls}
      type={Tag === 'button' ? type : undefined}
      data-studio-button={variant}
      data-studio-size={size}
      data-active={active || undefined}
      {...rest}
    >
      {children}
    </Tag>
  )
}
