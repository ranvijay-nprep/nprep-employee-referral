// Phone numbers reach this app from two places that format them differently:
// what an employee types into the referee tracker ("+91 98765 43210",
// "098765-43210") and what NPrep's `users.phone_number` column holds. Both are
// reduced to the same bare 10-digit national number so a share can be matched
// to a purchase.
const DEFAULT_COUNTRY_CODE = '91'

export function normalizePhone(raw: string | null | undefined): string {
  let digits = String(raw || '').replace(/\D/g, '')
  // Strip a country code / trunk prefix, longest first: +91-0-98…, 91-98…, 0-98…
  if (digits.length === 13 && digits.startsWith(`${DEFAULT_COUNTRY_CODE}0`)) digits = digits.slice(3)
  if (digits.length === 12 && digits.startsWith(DEFAULT_COUNTRY_CODE)) digits = digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  return digits
}

// A number we're willing to store/match on. Indian mobiles are 10 digits
// starting 6-9; anything else is almost certainly a typo, and a wrong number
// here would silently never match a purchase.
export function isValidPhone(raw: string | null | undefined): boolean {
  return /^[6-9]\d{9}$/.test(normalizePhone(raw))
}

// wa.me wants the full international number with no punctuation.
export function toWhatsAppNumber(raw: string | null | undefined): string {
  const digits = normalizePhone(raw)
  return digits ? `${DEFAULT_COUNTRY_CODE}${digits}` : ''
}

export function formatPhone(raw: string | null | undefined): string {
  const digits = normalizePhone(raw)
  if (digits.length !== 10) return String(raw || '')
  return `${digits.slice(0, 5)} ${digits.slice(5)}`
}
