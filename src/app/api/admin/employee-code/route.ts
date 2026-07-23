import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import {
  assignEmployeeCodeAndCreateCoupon,
  getCouponRequestByCode,
  getCouponRequestByEmployeeId,
  getEmployeeByCode,
  getEmployeeById,
  listAdmins,
  markCouponAdminNotified,
} from '@/lib/db'
import { nprepCouponExists } from '@/lib/nprepDb'
import { buildEmployeeCouponCode, isValidCode, normalizeEmployeeCode } from '@/lib/couponCode'
import { sendAdminCouponRequestEmail } from '@/lib/email'

const USAGE_LIMIT = 100
const EXPIRY_MONTHS = 6

// Admin action from the "Need attention" panel: set an employee's internal
// code and, in the same transaction, create their derived `NPrep<code>` coupon
// request. From there it flows through the exact same pipeline as before - an
// admin creates the real coupon in NPrep, and the cron flips it to active.
export async function POST(request: NextRequest) {
  await requireAdmin()

  const body = (await request.json().catch(() => ({}))) as { employeeId?: number; employeeCode?: string }
  const employeeId = Number(body.employeeId)
  const employeeCode = normalizeEmployeeCode(String(body.employeeCode || ''))

  if (!employeeId || !Number.isInteger(employeeId)) {
    return NextResponse.json({ error: 'Missing employee.' }, { status: 400 })
  }
  if (!employeeCode) {
    return NextResponse.json({ error: 'Enter an employee code (letters/numbers).' }, { status: 400 })
  }

  const employee = getEmployeeById(employeeId)
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found.' }, { status: 404 })
  }
  if (employee.employee_code) {
    return NextResponse.json({ error: 'This employee already has a code.' }, { status: 409 })
  }
  if (getCouponRequestByEmployeeId(employeeId)) {
    return NextResponse.json({ error: 'This employee already has a referral code.' }, { status: 409 })
  }

  const existingWithCode = getEmployeeByCode(employeeCode)
  if (existingWithCode && existingWithCode.id !== employeeId) {
    return NextResponse.json({ error: `Code "${employeeCode}" is already used by ${existingWithCode.email}.` }, { status: 409 })
  }

  const couponCode = buildEmployeeCouponCode(employeeCode)
  if (!isValidCode(couponCode)) {
    return NextResponse.json({ error: 'That employee code is too long.' }, { status: 400 })
  }

  if (getCouponRequestByCode(couponCode) || (await nprepCouponExists(couponCode))) {
    return NextResponse.json({ error: `Coupon "${couponCode}" already exists. Pick a different employee code.` }, { status: 409 })
  }

  const activationDate = new Date()
  const expiryDate = new Date(activationDate)
  expiryDate.setMonth(expiryDate.getMonth() + EXPIRY_MONTHS)

  let result
  try {
    result = assignEmployeeCodeAndCreateCoupon({
      employeeId,
      employeeCode,
      couponCode,
      usageLimit: USAGE_LIMIT,
      activationDate: isoDate(activationDate),
      expiryDate: isoDate(expiryDate),
    })
  } catch {
    // Unique-constraint race: the employee code or coupon code was taken
    // between the checks above and the transaction.
    return NextResponse.json({ error: 'That code was just taken - please try another.' }, { status: 409 })
  }

  try {
    const adminEmails = listAdmins().map((admin) => admin.email)
    await sendAdminCouponRequestEmail(result.request, employee.email, adminEmails)
    markCouponAdminNotified(result.request.id)
  } catch (emailError) {
    // The coupon request already exists and is visible on the pending
    // dashboard - a failed notification email shouldn't fail the approval.
    console.error('Failed to send admin coupon-request email', emailError)
  }

  return NextResponse.json({ employee: result.employee, request: result.request })
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}
