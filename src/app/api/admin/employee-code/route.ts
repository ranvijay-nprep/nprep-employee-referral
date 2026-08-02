import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import {
  activateCouponRequest,
  assignEmployeeCodeAndCreateCoupon,
  getCouponRequestByCode,
  getCouponRequestByEmployeeId,
  getDirectoryByNo,
  getEmployeeByCode,
  getEmployeeById,
  listAdmins,
  markCouponAdminNotified,
} from '@/lib/db'
import { getNprepCoupon } from '@/lib/nprepDb'
import { buildEmployeeCouponCode } from '@/lib/couponCode'
import { sendAdminCouponRequestEmail, sendEmployeeCouponActiveEmail } from '@/lib/email'

const USAGE_LIMIT = 100
const EXPIRY_MONTHS = 6

// Admin action from the "Need attention" panel: link a signed-in person whose
// email wasn't found in the directory to their actual directory entry.
//
// The code is NEVER free text - `employeeNo` must be an existing Employee No
// from the employee directory. Anything else is rejected.
export async function POST(request: NextRequest) {
  await requireAdmin()

  const body = (await request.json().catch(() => ({}))) as { employeeId?: number; employeeNo?: string | number }
  const employeeId = Number(body.employeeId)
  const employeeNo = String(body.employeeNo ?? '').trim()

  if (!employeeId || !Number.isInteger(employeeId)) {
    return NextResponse.json({ error: 'Missing employee.' }, { status: 400 })
  }
  if (!employeeNo) {
    return NextResponse.json({ error: 'Pick an employee from the directory.' }, { status: 400 })
  }

  // The code must come from the directory - no custom codes.
  const entry = getDirectoryByNo(employeeNo)
  if (!entry) {
    return NextResponse.json({ error: `"${employeeNo}" is not in the employee directory.` }, { status: 400 })
  }

  const employee = getEmployeeById(employeeId)
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found.' }, { status: 404 })
  }
  if (employee.employee_code) {
    return NextResponse.json({ error: 'This person already has a code.' }, { status: 409 })
  }
  if (getCouponRequestByEmployeeId(employeeId)) {
    return NextResponse.json({ error: 'This person already has a referral code.' }, { status: 409 })
  }

  const existingWithCode = getEmployeeByCode(entry.employee_no)
  if (existingWithCode && existingWithCode.id !== employeeId) {
    return NextResponse.json(
      { error: `Employee No ${entry.employee_no} is already linked to ${existingWithCode.email}.` },
      { status: 409 },
    )
  }

  const couponCode = buildEmployeeCouponCode(entry.employee_no)
  // Claimed in our own table = a real conflict the admin has to sort out.
  if (getCouponRequestByCode(couponCode)) {
    return NextResponse.json({ error: `Coupon "${couponCode}" already exists.` }, { status: 409 })
  }

  // Already in NPrep is NOT a conflict: the code is derived from the directory
  // entry the admin just picked, so that coupon is this person's - the NPrep<no>
  // coupons are bulk-created ahead of time. Refusing the link here left people
  // permanently unlinkable (Radheshyam Jangid / NPrep1092). Adopt it instead,
  // reusing NPrep's real validity window rather than inventing one.
  const liveCoupon = await getNprepCoupon(couponCode)

  const fallbackActivation = new Date()
  const fallbackExpiry = new Date(fallbackActivation)
  fallbackExpiry.setMonth(fallbackExpiry.getMonth() + EXPIRY_MONTHS)

  let result
  try {
    result = assignEmployeeCodeAndCreateCoupon({
      employeeId,
      employeeCode: entry.employee_no,
      couponCode,
      usageLimit: liveCoupon?.usageLimit ?? USAGE_LIMIT,
      activationDate: liveCoupon?.activationDate ?? isoDate(fallbackActivation),
      expiryDate: liveCoupon?.expiryDate ?? isoDate(fallbackExpiry),
    })
  } catch {
    // Unique-constraint race between the checks above and the transaction.
    return NextResponse.json({ error: 'That employee was just linked - please refresh.' }, { status: 409 })
  }

  // Live in NPrep already - nothing for an admin to create, so flip it active
  // and tell the employee their code works, instead of raising a request.
  if (liveCoupon) {
    activateCouponRequest(result.request.id)
    try {
      await sendEmployeeCouponActiveEmail(employee.email, couponCode)
    } catch (emailError) {
      console.error('Failed to send employee coupon-active email', emailError)
    }
    return NextResponse.json({
      employee: result.employee,
      request: getCouponRequestByCode(couponCode) ?? result.request,
    })
  }

  try {
    const adminEmails = listAdmins().map((admin) => admin.email)
    await sendAdminCouponRequestEmail(result.request, employee.email, adminEmails)
    markCouponAdminNotified(result.request.id)
  } catch (emailError) {
    // Already visible on the pending dashboard - don't fail the link.
    console.error('Failed to send admin coupon-request email', emailError)
  }

  return NextResponse.json({ employee: result.employee, request: result.request })
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}
