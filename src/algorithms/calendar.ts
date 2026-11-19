const dayMs = 86_400_000
const datePattern = /^\d{4}-\d{2}-\d{2}$/

export function localDate(date = new Date()) {
  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

// UTC arithmetic here operates on calendar dates, independent of the local clock and DST.
function dateTime(date: string) {
  return Date.parse(date + 'T00:00:00Z')
}

export function isCalendarDate(date: string) {
  if (!datePattern.test(date) || date.startsWith('0000-')) return false

  const time = dateTime(date)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date
}

export function endDate(start: string, duration: number): string | null {
  if (!isCalendarDate(start) || !Number.isSafeInteger(duration) || duration < 1) return null

  const result = new Date(dateTime(start) + (duration - 1) * dayMs)
  if (!Number.isFinite(result.getTime()) || result.getUTCFullYear() > 9999) return null
  return result.toISOString().slice(0, 10)
}

export function dayDifference(from: string, to: string) {
  return (dateTime(to) - dateTime(from)) / dayMs
}

const calendar = new Intl.DateTimeFormat('vi-VN', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatCalendarDate(value: string) {
  return calendar.format(new Date(value + 'T00:00:00Z'))
}

