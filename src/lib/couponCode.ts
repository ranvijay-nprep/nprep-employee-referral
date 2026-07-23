// Coupon codes are derived from an employee's internal code as
// `NPrep<employee_code>` - they are no longer employee-chosen. This module
// normalises the employee-code part and builds/validates the final code.
const MAX_CODE_LENGTH = 12
const MIN_CODE_LENGTH = 3
const COUPON_PREFIX = 'NPrep'

// The most an employee_code can be once the "NPrep" prefix is accounted for.
export const MAX_EMPLOYEE_CODE_LENGTH = MAX_CODE_LENGTH - COUPON_PREFIX.length

// Letters/digits only, uppercased. Used for the employee-code part before it's
// prefixed - keeps the final coupon clean for a customer to read/type.
export function normalizeCode(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, MAX_CODE_LENGTH)
}

// Normalises an admin-entered employee code (letters/digits, uppercased,
// length-capped so the final coupon fits within MAX_CODE_LENGTH).
export function normalizeEmployeeCode(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, MAX_EMPLOYEE_CODE_LENGTH)
}

// Builds the final referral coupon from a (already normalised) employee code.
// e.g. "042" -> "NPrep042". Matching against NPrep's coupons is case-insensitive
// (see report.ts / nprepDb.ts), so the mixed-case prefix is safe.
export function buildEmployeeCouponCode(employeeCode: string): string {
  return `${COUPON_PREFIX}${employeeCode}`
}

export function isValidCode(code: string): boolean {
  return code.length >= MIN_CODE_LENGTH && code.length <= MAX_CODE_LENGTH
}
