import { requireAdmin } from '@/lib/auth'
import {
  getActiveEmployeeByCoupon,
  getAdminOverviewStats,
  getEmployeesNeedingCode,
  getPendingCouponRequests,
  getUnassignedDirectory,
  listAdmins,
} from '@/lib/db'
import { ensureReferralForLogin } from '@/lib/autoAssign'
import AdminDashboard from '@/components/AdminDashboard'

export default async function AdminPage() {
  const session = await requireAdmin()

  // Admins are referrers too - auto-assign their own code on view (best-effort).
  await ensureReferralForLogin(session.employee)

  const employeesNeedingCode = getEmployeesNeedingCode()
  const directoryOptions = getUnassignedDirectory()
  const pendingRequests = getPendingCouponRequests()
  const activeEmployees = [...getActiveEmployeeByCoupon().entries()].map(([code, employee]) => ({
    employeeId: employee.employeeId,
    name: employee.name,
    code,
  }))
  const admins = listAdmins()
  const overview = getAdminOverviewStats()

  return (
    <AdminDashboard
      adminName={session.employee.name}
      currentAdminId={session.employee.id}
      admins={admins}
      overview={overview}
      employeesNeedingCode={employeesNeedingCode}
      directoryOptions={directoryOptions}
      pendingRequests={pendingRequests}
      activeEmployees={activeEmployees}
    />
  )
}
