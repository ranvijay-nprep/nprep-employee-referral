import { requireAdmin } from '@/lib/auth'
import { getEmployeesNeedingCode, getPendingCouponRequests } from '@/lib/db'
import { ensureReferralForLogin } from '@/lib/autoAssign'
import AdminShell from '@/components/AdminShell'

// Wraps every /admin/* route in the sidebar. requireAdmin runs here so no
// admin page can be reached without it, and the auto-assign that used to live
// on the overview page moved here - admins are referrers too, and it should
// happen whichever admin page they land on.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin()
  await ensureReferralForLogin(session.employee)

  return (
    <AdminShell
      adminName={session.employee.name}
      badges={{ needsAttention: getEmployeesNeedingCode().length, pending: getPendingCouponRequests().length }}
    >
      {children}
    </AdminShell>
  )
}
