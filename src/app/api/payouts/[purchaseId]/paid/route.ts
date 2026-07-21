import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { markPayoutPaid } from '@/lib/db'
import { getActiveEmployeeByCoupon, getReferralReport } from '@/lib/report'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ purchaseId: string }> }) {
  const session = await requireAdmin()
  const { purchaseId } = await params
  const id = Number(purchaseId)
  if (!id) return NextResponse.json({ error: 'Invalid purchase id' }, { status: 400 })

  const employeeByCoupon = getActiveEmployeeByCoupon()
  const couponCodes = [...employeeByCoupon.keys()]
  const { rows } = await getReferralReport({ couponCodes, status: 'successful', purchaseIds: [id], maskContact: false })
  const row = rows[0]
  if (!row) return NextResponse.json({ error: 'Mapped successful transaction not found' }, { status: 404 })
  if (!row.incentiveAmount) return NextResponse.json({ error: 'This transaction has no incentive amount' }, { status: 400 })

  const payout = markPayoutPaid({
    purchaseId: row.purchaseId,
    employeeId: row.employeeId,
    couponCode: row.couponCode,
    incentiveAmount: row.incentiveAmount,
    paidByAdminId: session.userId,
  })

  return NextResponse.json({ payout })
}
