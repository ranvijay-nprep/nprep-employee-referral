import { getActiveEmployeeByCoupon } from '@/lib/db'
import ReferralsPanel from '@/components/ReferralsPanel'

export default async function AdminReferralsPage() {
  const activeEmployees = [...getActiveEmployeeByCoupon().entries()].map(([code, employee]) => ({
    employeeId: employee.employeeId,
    name: employee.name,
    department: employee.department,
    designation: employee.designation,
    code,
  }))

  return <ReferralsPanel activeEmployees={activeEmployees} />
}
