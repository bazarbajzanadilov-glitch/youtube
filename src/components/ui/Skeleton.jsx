import s from './Skeleton.module.css'

export default function Skeleton({ width = '100%', height = 16, radius = 6, className = '' }) {
  return (
    <span
      className={`${s.skel} ${className}`}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  )
}
