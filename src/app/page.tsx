import { requireSession } from '@/lib/auth'
import { getCouponRequestByEmployeeId } from '@/lib/db'
import EmployeeHome from '@/components/EmployeeHome'

// The referrer dashboard - shown to everyone, admins included. Admins reach it
// via the Admin/Referrer switch (see ViewSwitch); they get their own referral
// code here just like an employee. Default landing per role is decided in the
// auth callback, not by a redirect here.
export default async function HomePage() {
  const session = await requireSession()

  const coupon = getCouponRequestByEmployeeId(session.userId)
  return <EmployeeHome employee={session.employee} coupon={coupon} />
}
