export const DEFAULT_AVERAGE_VIEW_PERCENTAGE = 45.1

export function normalizeAverageViewPercentage(value) {
  if (value == null || (typeof value === 'string' && value.trim() === '')) {
    return DEFAULT_AVERAGE_VIEW_PERCENTAGE
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_AVERAGE_VIEW_PERCENTAGE
  return Math.min(100, Math.max(0, Math.round(parsed * 100) / 100))
}

export function averageViewFraction(video) {
  const percentage = normalizeAverageViewPercentage(video?.averageViewPercentage)
  return percentage / 100
}
