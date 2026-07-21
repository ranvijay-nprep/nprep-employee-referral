import { activateCouponRequest, getPendingCouponRequests } from '@/lib/db'
import { nprepCouponExists } from '@/lib/nprepDb'
import { sendEmployeeCouponActiveEmail } from '@/lib/email'

// Checks every pending coupon_requests row against NPrep's real coupons table
// (read-only) and flips it to 'active' once an admin has manually created it
// there, emailing the employee automatically. Called both from an in-process
// node-cron schedule (src/instrumentation.ts) and from the HTTP route below,
// which exists as a manual/debug trigger.
export async function checkCouponActivations(): Promise<{ checked: number; activated: number }> {
  const pending = getPendingCouponRequests()
  let activated = 0

  for (const request of pending) {
    const exists = await nprepCouponExists(request.code)
    if (!exists) continue

    activateCouponRequest(request.id)
    try {
      await sendEmployeeCouponActiveEmail(request.employeeEmail, request.code)
    } catch (error) {
      console.error(`Failed to send activation email for coupon ${request.code}`, error)
    }
    activated += 1
  }

  return { checked: pending.length, activated }
}
