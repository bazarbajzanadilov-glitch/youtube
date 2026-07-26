export function normalizeAverageViewPercentage(value) {
  if (value === '' || value == null) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.min(100, Math.max(0, Math.round(parsed * 100) / 100))
}

export function averageViewFraction(video) {
  const percentage = normalizeAverageViewPercentage(video?.averageViewPercentage)
  return percentage == null ? null : percentage / 100
}
