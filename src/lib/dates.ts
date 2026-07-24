// Dates are formatted with an explicit locale AND timezone on purpose.
//
// Bare `toLocaleString()` resolves against whatever the *runtime* is set to,
// so a client component rendered on the server produced one string and a
// different one in the browser - React reported a hydration mismatch and threw
// the whole tree away to re-render it. Pinning both sides makes the output
// deterministic, and IST is the right answer for the people using this anyway.
const LOCALE = 'en-IN'
const TIME_ZONE = 'Asia/Kolkata'

const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: TIME_ZONE,
})

const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
})

export function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? dateFormat.format(date) : '—'
}

export function formatDateTime(value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? dateTimeFormat.format(date) : '—'
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
