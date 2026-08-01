import {
  activateCouponRequest,
  assignEmployeeCodeAndCreateCoupon,
  getCouponRequestByCode,
  getCouponRequestByEmployeeId,
  getDirectoryByEmail,
  listAdmins,
  markCouponAdminNotified,
} from '@/lib/db'
import { nprepCouponExists } from '@/lib/nprepDb'
import { buildEmployeeCouponCode } from '@/lib/couponCode'
import { sendAdminCouponRequestEmail, sendEmployeeCouponActiveEmail } from '@/lib/email'
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

    // Someone already holds this code in our own table - a genuine conflict
    // only an admin can untangle. Never take it off them.
    if (getCouponRequestByCode(couponCode)) return

    // The code is built from *this* person's directory Employee No, so a coupon
    // already sitting in NPrep under that exact code is theirs by construction -
    // admins routinely bulk-create the NPrep<no> coupons ahead of first login.
    // Adopt it as already-active instead of skipping. The old `return` here
    // stranded every such employee permanently: no code, no coupon row, and so
    // their referrals were unattributable in the report (see NPrep2038).
    // If this check can't run (e.g. NPrep DB down) it throws, the outer catch
    // swallows it, and nothing is created - we retry on the next page hit.
    const alreadyLiveInNprep = await nprepCouponExists(couponCode)

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

    // Already live in NPrep - there is nothing for an admin to create, so skip
    // the request email, flip it active immediately and tell the employee their
    // code is ready. This is also what heals the employees stranded by the old
    // guard: they pick their code up on their next authenticated page hit.
    if (alreadyLiveInNprep) {
      activateCouponRequest(request.id)
      try {
        await sendEmployeeCouponActiveEmail(employee.email, couponCode)
      } catch (emailError) {
        console.error('auto-assign: employee activation email failed', emailError)
      }
      return
    }

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
