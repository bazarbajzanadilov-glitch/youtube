const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

const CHART_DATE_FORMAT = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function getPart(parts, type) {
  return parts.find((part) => part.type === type)?.value || ''
}

export function formatChartDateLabel(label) {
  if (typeof label !== 'string') return label
  const match = ISO_DATE_RE.exec(label)
  if (!match) return label

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const parts = CHART_DATE_FORMAT.formatToParts(date)
  const weekday = getPart(parts, 'weekday').replace(/\.$/, '')
  const day = getPart(parts, 'day')
  const month = getPart(parts, 'month')
  const year = getPart(parts, 'year')

  if (!weekday || !day || !month || !year) return label
  return `${weekday}, ${day} ${month}, ${year}`
}
