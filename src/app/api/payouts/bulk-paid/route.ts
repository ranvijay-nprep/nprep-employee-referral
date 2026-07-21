import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getPaidPayoutMap, markPayoutPaid } from '@/lib/db'
import { getActiveEmployeeByCoupon, getReferralReport } from '@/lib/report'

export async function POST(request: NextRequest) {
  const session = await requireAdmin()
  const body = (await request.json().catch(() => ({}))) as { purchaseIds?: unknown[] }
  const purchaseIds = Array.isArray(body.purchaseIds) ? [...new Set(body.purchaseIds.map(Number).filter(Boolean))] : []
  if (!purchaseIds.length) return NextResponse.json({ error: 'No purchase IDs provided in the file' }, { status: 400 })

  const employeeByCoupon = getActiveEmployeeByCoupon()
  const couponCodes = [...employeeByCoupon.keys()]
  const { rows } = await getReferralReport({ couponCodes, status: 'successful', purchaseIds, maskContact: false })
  const byId = new Map(rows.map((row) => [row.purchaseId, row]))
  const alreadyPaidMap = getPaidPayoutMap(purchaseIds)

  const result = { requested: purchaseIds.length, marked: 0, alreadyPaid: 0, invalid: [] as number[] }

  for (const id of purchaseIds) {
    const row = byId.get(id)
    if (!row || !row.incentiveAmount) {
      result.invalid.push(id)
      continue
    }
    if (alreadyPaidMap.has(id)) {
      result.alreadyPaid += 1
      continue
    }
    markPayoutPaid({
      purchaseId: row.purchaseId,
      employeeId: row.employeeId,
      couponCode: row.couponCode,
      incentiveAmount: row.incentiveAmount,
      paidByAdminId: session.userId,
    })
    result.marked += 1
  }

  return NextResponse.json(result)
}
