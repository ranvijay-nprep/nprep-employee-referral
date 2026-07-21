// Normalises a user-typed coupon code candidate: letters/digits only,
// uppercased, capped at a reasonable length for something a customer will
// read/type at checkout.
const MAX_CODE_LENGTH = 12
const MIN_CODE_LENGTH = 3

export function normalizeCode(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, MAX_CODE_LENGTH)
}

export function isValidCode(code: string): boolean {
  return code.length >= MIN_CODE_LENGTH && code.length <= MAX_CODE_LENGTH
}

// Generates fallback suggestions when the employee's preferred code is taken:
// a couple of short random-digit variants, in order of preference.
export function suggestAlternates(base: string, count = 3): string[] {
  const trimmedBase = base.slice(0, MAX_CODE_LENGTH - 2)
  const suggestions = new Set<string>()
  let attempts = 0
  while (suggestions.size < count && attempts < 20) {
    attempts += 1
    const suffix = String(Math.floor(Math.random() * 90) + 10) // 2-digit, 10-99
    suggestions.add(`${trimmedBase}${suffix}`)
  }
  return [...suggestions]
}
