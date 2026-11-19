import { formatCalendarDate as formatDate } from '../../algorithms/calendar.ts'

export { formatDate }

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
export function formatVnd(amount: number) {
  return currency.format(amount)
}

export function formatPeriod(start: string, end: string) {
  return start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`
}

export function wholeNumber(value: string) {
  const trimmed = value.trim()
  return /^\d+$/.test(trimmed) ? Number(trimmed) : NaN
}
