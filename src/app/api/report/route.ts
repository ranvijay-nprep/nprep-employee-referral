import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth'
import { getCouponRequestByEmployeeId } from '@/lib/db'
import { getActiveEmployeeByCoupon, getReferralReport } from '@/lib/report'

export async function GET(request: NextRequest) {
  const session = await requireSession()
  const params = new URL(request.url).searchParams
  const status = (params.get('status') as 'all' | 'successful' | 'failed' | 'pending') || 'all'
  const fromDate = params.get('fromDate')
  const toDate = params.get('toDate')
  const employeeIdFilter = params.get('employeeId')
  // An admin viewing their OWN referrer dashboard passes scope=self, so they
  // get their personal referrals (their own coupon) instead of the org-wide
  // admin report. Without it, an admin always gets the full admin report.
  const scopeSelf = params.get('scope') === 'self'

  if (session.employee.role === 'admin' && !scopeSelf) {
    const employeeByCoupon = getActiveEmployeeByCoupon()
    let entries = [...employeeByCoupon.entries()]
    if (employeeIdFilter) entries = entries.filter(([, value]) => String(value.employeeId) === employeeIdFilter)
    const couponCodes = entries.map(([code]) => code)

    if (!couponCodes.length) {
      return NextResponse.json({ rows: [], summary: { total: 0, successful: 0, failed: 0, pending: 0, revenue: 0, incentive: 0, receivable: 0 } })
    }

    const report = await getReferralReport({ couponCodes, status, fromDate, toDate, maskContact: false })
    return NextResponse.json(report)
  }

  const coupon = getCouponRequestByEmployeeId(session.userId)
  if (!coupon || coupon.status !== 'active') {
    return NextResponse.json({ rows: [], summary: { total: 0, successful: 0, failed: 0, pending: 0, revenue: 0, incentive: 0, receivable: 0 } })
  }

  const report = await getReferralReport({ couponCodes: [coupon.code], status, fromDate, toDate, maskContact: true })
  return NextResponse.json(report)
}
