import { requireAdmin } from '@/lib/auth'
import { getActiveEmployeeByCoupon, getPendingCouponRequests } from '@/lib/db'
import AdminDashboard from '@/components/AdminDashboard'

export default async function AdminPage() {
  const session = await requireAdmin()

  const pendingRequests = getPendingCouponRequests()
  const activeEmployees = [...getActiveEmployeeByCoupon().entries()].map(([code, employee]) => ({
    employeeId: employee.employeeId,
    name: employee.name,
    code,
  }))

  return <AdminDashboard adminName={session.employee.name} pendingRequests={pendingRequests} activeEmployees={activeEmployees} />
}
