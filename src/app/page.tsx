import { requireSession } from '@/lib/auth'
import { getCouponRequestByEmployeeId, getDirectoryByEmail } from '@/lib/db'
import { ensureReferralForLogin } from '@/lib/autoAssign'
import EmployeeHome from '@/components/EmployeeHome'

// The referrer dashboard - shown to everyone, admins included. Admins reach it
// via the Admin/Referrer switch (see ViewSwitch); they get their own referral
// code here just like an employee. Default landing per role is decided in the
// auth callback, not by a redirect here.
export default async function HomePage() {
  const session = await requireSession()

  // Covers existing sessions (whose login predates this): try the directory
  // auto-assign on view too. Best-effort and a no-op once they have a code.
  await ensureReferralForLogin(session.employee)

  const coupon = getCouponRequestByEmployeeId(session.userId)
  const directory = getDirectoryByEmail(session.email)
  return <EmployeeHome employee={session.employee} coupon={coupon} directoryCode={directory?.employee_no ?? null} />
}
