import { requireAdmin } from '@/lib/auth'
import { getActiveEmployeeByCoupon, getAdminOverviewStats, getPendingCouponRequests, listAdmins } from '@/lib/db'
import AdminDashboard from '@/components/AdminDashboard'

export default async function AdminPage() {
  const session = await requireAdmin()

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
      pendingRequests={pendingRequests}
      activeEmployees={activeEmployees}
    />
  )
}
