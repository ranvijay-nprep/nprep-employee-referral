import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { getCouponRequestByEmployeeId } from '@/lib/db'
import EmployeeHome from '@/components/EmployeeHome'

export default async function HomePage() {
  const session = await requireSession()
  if (session.employee.role === 'admin') redirect('/admin')

  const coupon = getCouponRequestByEmployeeId(session.userId)
  return <EmployeeHome employee={session.employee} coupon={coupon} />
}
