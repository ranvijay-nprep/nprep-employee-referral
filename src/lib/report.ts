import type { RowDataPacket } from 'mysql2/promise'
import { getNprepPool } from '@/lib/nprepDb'
import { getActiveEmployeeByCoupon, getPaidPayoutMap } from '@/lib/db'
import { incentiveForPurchase } from '@/lib/incentives'
import type { NprepPurchaseRow, ReferralRow, ReferralSummary } from '@/lib/types'

const SUCCESS_STATUSES = new Set(['Completed', 'PartiallyPaid'])

export interface GetReportOptions {
  couponCodes: string[]
  status?: 'all' | 'successful' | 'failed' | 'pending'
  fromDate?: string | null
  toDate?: string | null
  purchaseIds?: number[]
  maskContact?: boolean
}

export { getActiveEmployeeByCoupon }

export async function getReferralReport(options: GetReportOptions): Promise<{ rows: ReferralRow[]; summary: ReferralSummary }> {
  const { couponCodes, status = 'all', fromDate, toDate, purchaseIds, maskContact = true } = options
  const employeeByCoupon = getActiveEmployeeByCoupon()

  const couponList = couponCodes.map((code) => code.trim().toUpperCase()).filter(Boolean)
  if (!couponList.length) return { rows: [], summary: emptySummary() }

  const params: Array<string | number> = [...couponList]
  const couponPlaceholders = couponList.map(() => '?').join(', ')

  const idList = [...new Set((purchaseIds || []).filter(Boolean))]
  const idsWhere = idList.length ? `AND sp.id IN (${idList.map(() => '?').join(', ')})` : ''

  const statusWhere =
    status === 'successful'
      ? "AND sp.is_active = 1 AND sp.status IN ('Completed', 'PartiallyPaid')"
      : status === 'failed'
        ? "AND sp.status = 'Failed'"
        : status === 'pending'
          ? "AND sp.status = 'Pending'"
          : ''

  if (idList.length) params.push(...idList)
  if (fromDate) params.push(fromDate)
  if (toDate) params.push(toDate)

  const [rows] = await getNprepPool().query<RowDataPacket[]>(
    `
      SELECT
        sp.id AS purchase_id, sp.user_id,
        TRIM(CONCAT_WS(' ', u.first_name, u.last_name)) AS student_name,
        u.phone_number AS student_phone, u.email AS student_email,
        sp.subscription_id AS plan_id, s.name AS plan_name,
        sp.duration, sp.unit, sp.price, sp.status, sp.is_active,
        sp.created_at, sp.activated_at, c.code AS coupon_code
      FROM subscription_purchases sp
      JOIN users u ON u.id = sp.user_id AND u.is_staff = 0
      JOIN coupons c ON c.id = sp.coupon_id
      LEFT JOIN subscriptions s ON s.id = sp.subscription_id
      WHERE sp.deleted_at IS NULL
        AND sp.price > 0
        AND UPPER(c.code) IN (${couponPlaceholders})
        ${statusWhere}
        ${idsWhere}
        ${fromDate ? 'AND DATE(sp.created_at) >= ?' : ''}
        ${toDate ? 'AND DATE(sp.created_at) <= ?' : ''}
      ORDER BY sp.created_at DESC
      LIMIT 1000
    `,
    params,
  )

  const purchaseRows = rows as NprepPurchaseRow[]
  const payoutMap = getPaidPayoutMap(purchaseRows.map((row) => row.purchase_id))

  const referralRows: ReferralRow[] = purchaseRows.map((row) => {
    const successful = row.is_active === 1 && SUCCESS_STATUSES.has(row.status)
    const payout = payoutMap.get(row.purchase_id)
    const employee = employeeByCoupon.get(String(row.coupon_code || '').toUpperCase())
    return {
      purchaseId: row.purchase_id,
      studentName: row.student_name || 'Student',
      studentPhone: maskContact ? maskPhone(row.student_phone) : row.student_phone || '',
      planName: row.plan_name || `Plan ${row.plan_id}`,
      planDuration: formatDuration(row.unit, row.duration),
      price: Number(row.price || 0),
      status: row.status,
      isSuccessful: successful,
      couponCode: row.coupon_code,
      employeeId: employee?.employeeId || null,
      employeeName: employee?.name || null,
      createdAt: row.created_at as string | null,
      incentiveAmount: successful ? incentiveForPurchase(row.plan_id) : 0,
      isPaid: Boolean(payout),
      paidAt: payout?.paid_at || null,
    }
  })

  return { rows: referralRows, summary: summarize(referralRows) }
}

export function summarize(rows: ReferralRow[]): ReferralSummary {
  return rows.reduce<ReferralSummary>(
    (summary, row) => {
      summary.total += 1
      summary.revenue += row.isSuccessful ? row.price : 0
      summary.incentive += row.incentiveAmount
      if (!row.isPaid) summary.receivable += row.incentiveAmount
      if (row.isSuccessful) summary.successful += 1
      else if (row.status === 'Failed') summary.failed += 1
      else summary.pending += 1
      return summary
    },
    emptySummary(),
  )
}

function emptySummary(): ReferralSummary {
  return { total: 0, successful: 0, failed: 0, pending: 0, revenue: 0, incentive: 0, receivable: 0 }
}

function formatDuration(unit: string | null | undefined, duration: number | string | null | undefined): string {
  const value = Number(duration) || 0
  const label = String(unit || '').trim()
  if (!value || !label) return ''
  return `${value} ${label}${value === 1 ? '' : 's'}`
}

function maskPhone(phone: string | null | undefined): string {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length < 4) return ''
  return `${digits.slice(0, 2)}******${digits.slice(-2)}`
}
