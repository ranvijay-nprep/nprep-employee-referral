import { listAllShares, listSharesByEmployee } from '@/lib/db'
import { getReferralReport } from '@/lib/report'
import { normalizePhone } from '@/lib/phone'
import type { ReferralRow, ReferralShare, ReferralShareRow, ShareStatus } from '@/lib/types'

// Turns "who I shared my coupon with" into "did they actually buy?".
//
// NPrep's purchase rows carry no notion of a referee - a coupon is a broadcast
// code - so the join is done here, on phone number: the number the employee
// recorded when sharing vs. `users.phone_number` on a purchase made with their
// coupon. Both sides go through normalizePhone so formatting differences
// ("+91 98765 43210" vs "9876543210") don't cause a false "not purchased".
//
// Nothing here is written back to the shares table: status is always derived
// live, so a purchase that later gets refunded/cancelled in NPrep stops
// showing as converted on its own.
const SHARE_ROW_LIMIT = 5000

export interface ShareTrackerResult {
  rows: ReferralShareRow[]
  // False when NPrep's DB couldn't be reached - every row then reads as
  // "waiting", which would otherwise look like a genuine zero-conversion.
  purchaseCheckAvailable: boolean
}

export async function getShareTracker(employeeId: number, couponCode: string | null): Promise<ShareTrackerResult> {
  const shares = listSharesByEmployee(employeeId)
  if (!shares.length) return { rows: [], purchaseCheckAvailable: true }
  if (!couponCode) return { rows: shares.map((share) => toRow(share, [])), purchaseCheckAvailable: true }

  try {
    const purchasesByPhone = await loadPurchasesByPhone([couponCode])
    return {
      rows: shares.map((share) => toRow(share, purchasesByPhone.get(share.referee_phone) || [])),
      purchaseCheckAvailable: true,
    }
  } catch (error) {
    console.error('Share tracker: could not read purchases from NPrep', error)
    return { rows: shares.map((share) => toRow(share, [])), purchaseCheckAvailable: false }
  }
}

// Org-wide share/conversion counts for the analytics dashboard. Takes the
// purchase rows the caller already fetched rather than re-querying MySQL.
export function summariseAllShares(purchaseRows: ReferralRow[]): {
  tracked: number
  converted: number
  byEmployee: Map<number, { tracked: number; converted: number }>
} {
  const successfulPhones = new Set(
    purchaseRows.filter((row) => row.isSuccessful).map((row) => normalizePhone(row.studentPhone)).filter(Boolean),
  )
  const byEmployee = new Map<number, { tracked: number; converted: number }>()
  let tracked = 0
  let converted = 0

  for (const share of listAllShares()) {
    const entry = byEmployee.get(share.employee_id) || { tracked: 0, converted: 0 }
    entry.tracked += 1
    tracked += 1
    if (successfulPhones.has(share.referee_phone)) {
      entry.converted += 1
      converted += 1
    }
    byEmployee.set(share.employee_id, entry)
  }

  return { tracked, converted, byEmployee }
}

async function loadPurchasesByPhone(couponCodes: string[]): Promise<Map<string, ReferralRow[]>> {
  // maskContact: false is required for the match to work at all - the masked
  // form ("98******10") has no digits to compare. These raw numbers stay on
  // the server; only the derived status is ever sent to the browser.
  const { rows } = await getReferralReport({ couponCodes, maskContact: false, limit: SHARE_ROW_LIMIT })
  const byPhone = new Map<string, ReferralRow[]>()
  for (const row of rows) {
    const phone = normalizePhone(row.studentPhone)
    if (!phone) continue
    const list = byPhone.get(phone)
    if (list) list.push(row)
    else byPhone.set(phone, [row])
  }
  return byPhone
}

function toRow(share: ReferralShare, purchases: ReferralRow[]): ReferralShareRow {
  const successful = purchases.find((row) => row.isSuccessful)
  const inProgress = purchases.find((row) => !row.isSuccessful && row.status !== 'Failed')
  const match = successful || inProgress || purchases[0] || null

  const status: ShareStatus = successful ? 'purchased' : inProgress ? 'in_progress' : purchases.length ? 'failed' : 'waiting'

  return {
    ...share,
    status,
    purchaseId: match?.purchaseId ?? null,
    purchasedAt: successful?.createdAt ?? null,
    planName: match ? `${match.planName}${match.planDuration ? ` ${match.planDuration}` : ''}` : null,
    amount: match?.price ?? null,
    incentiveAmount: successful?.incentiveAmount ?? 0,
    daysSinceShared: daysSince(share.shared_at),
  }
}

function daysSince(iso: string): number {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return 0
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000))
}
