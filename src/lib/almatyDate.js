export const ALMATY_TIME_ZONE = 'Asia/Almaty'

const almatyDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: ALMATY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function getAlmatyDateISO(value = new Date()) {
  const parts = Object.fromEntries(
    almatyDateFormatter
      .formatToParts(value)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}
