import {
  assignEmployeeCodeAndCreateCoupon,
  getCouponRequestByCode,
  getCouponRequestByEmployeeId,
  getDirectoryByEmail,
  listAdmins,
  markCouponAdminNotified,
} from '@/lib/db'
import { nprepCouponExists } from '@/lib/nprepDb'
import { buildEmployeeCouponCode } from '@/lib/couponCode'
import { sendAdminCouponRequestEmail } from '@/lib/email'
import type { Employee } from '@/lib/types'

const USAGE_LIMIT = 100
const EXPIRY_MONTHS = 6

// Automatic-on-login: if this person's login email is in the employee directory
// and they don't have a referral code yet, assign their directory Employee No
// as their code and create the NPrep<no> coupon request (which then flows
// through the usual admin-creates-it-in-NPrep + cron-activates pipeline).
//
// Fully best-effort: any failure (NPrep DB unreachable, a race, etc.) is
// swallowed so it never blocks login or page rendering - it simply retries the
// next time the person hits an authenticated page. Codes are never invented
// here; they come straight from the directory.
export async function ensureReferralForLogin(employee: Employee): Promise<void> {
  try {
    // Already sorted (has a code or a coupon) - nothing to do.
    if (employee.employee_code || getCouponRequestByEmployeeId(employee.id)) return
    if (!employee.email) return

    const entry = getDirectoryByEmail(employee.email)
    if (!entry) return // not in the directory -> admin links them via "Need attention"

    const couponCode = buildEmployeeCouponCode(entry.employee_no)

    // Don't create if this code already exists - locally, or as a real NPrep
    // coupon (which would be someone else's). If the NPrep check can't run
    // (e.g. DB down), bail and retry later rather than risk a mis-attribution.
    if (getCouponRequestByCode(couponCode)) return
    if (await nprepCouponExists(couponCode)) return

    const activationDate = new Date()
    const expiryDate = new Date(activationDate)
    expiryDate.setMonth(expiryDate.getMonth() + EXPIRY_MONTHS)

    const { request } = assignEmployeeCodeAndCreateCoupon({
      employeeId: employee.id,
      employeeCode: entry.employee_no,
      couponCode,
      usageLimit: USAGE_LIMIT,
      activationDate: isoDate(activationDate),
      expiryDate: isoDate(expiryDate),
    })

    try {
      const adminEmails = listAdmins().map((admin) => admin.email)
      await sendAdminCouponRequestEmail(request, employee.email, adminEmails)
      markCouponAdminNotified(request.id)
    } catch (emailError) {
      // The request is already visible on the admin pending list - a failed
      // notification email must not undo the assignment.
      console.error('auto-assign: admin notification email failed', emailError)
    }
  } catch (error) {
    console.error('ensureReferralForLogin failed', error)
  }
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}
