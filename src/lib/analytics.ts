import { getActiveEmployeeByCoupon } from '@/lib/db'
import type { CouponOwner } from '@/lib/db'
import { getReferralReport } from '@/lib/report'
import { summariseAllShares } from '@/lib/shares'
import type { AnalyticsPayload, DepartmentStat, MonthlyStat, PerformerStat, ReferralRow } from '@/lib/types'

// Org-wide referral analytics for the admin dashboard.
//
// Everything is derived from one pass over the purchase rows already exposed
// by getReferralReport - no new SQL against NPrep, and the same
// successful/incentive definitions as the payout report, so a number here can
// never disagree with the number on the payouts screen.
const ANALYTICS_ROW_LIMIT = 20_000
const UNASSIGNED = 'Unassigned'

export async function getAnalytics(options: { fromDate?: string | null; toDate?: string | null } = {}): Promise<AnalyticsPayload> {
  const owners = getActiveEmployeeByCoupon()
  const couponCodes = [...owners.keys()]

  const { rows } =
    couponCodes.length
      ? await getReferralReport({
          couponCodes,
          maskContact: false,
          limit: ANALYTICS_ROW_LIMIT,
          fromDate: options.fromDate,
          toDate: options.toDate,
        })
      : { rows: [] as ReferralRow[] }

  return buildAnalytics(rows, owners, summariseAllShares(rows))
}

// The aggregation itself: pure, no I/O, so it can be exercised directly
// against fabricated purchase rows.
export function buildAnalytics(
  rows: ReferralRow[],
  owners: Map<string, CouponOwner>,
  shares: { tracked: number; converted: number },
): AnalyticsPayload {
  /* Per-employee ------------------------------------------------------ */
  // Seeded from the coupon owners, not from the purchase rows, so a referrer
  // with an active code and zero sales still appears (at the bottom) instead
  // of vanishing from the leaderboard.
  const performers = new Map<number, PerformerStat>()
  for (const [code, owner] of owners) {
    performers.set(owner.employeeId, {
      employeeId: owner.employeeId,
      name: owner.name,
      department: owner.department || UNASSIGNED,
      designation: owner.designation || '—',
      couponCode: code,
      total: 0,
      successful: 0,
      revenue: 0,
      incentive: 0,
      conversionRate: 0,
    })
  }

  for (const row of rows) {
    if (row.employeeId == null) continue
    const performer = performers.get(row.employeeId)
    if (!performer) continue
    performer.total += 1
    if (row.isSuccessful) {
      performer.successful += 1
      performer.revenue += row.price
    }
    performer.incentive += row.incentiveAmount
  }

  const topPerformers = [...performers.values()]
    .map((performer) => ({ ...performer, conversionRate: rate(performer.successful, performer.total) }))
    .sort((a, b) => b.successful - a.successful || b.revenue - a.revenue || a.name.localeCompare(b.name))

  /* Per-department ---------------------------------------------------- */
  const departments = new Map<string, DepartmentStat>()
  for (const performer of topPerformers) {
    const stat =
      departments.get(performer.department) ||
      ({
        department: performer.department,
        referrers: 0,
        activeReferrers: 0,
        total: 0,
        successful: 0,
        revenue: 0,
        incentive: 0,
        conversionRate: 0,
      } satisfies DepartmentStat)
    stat.referrers += 1
    if (performer.successful > 0) stat.activeReferrers += 1
    stat.total += performer.total
    stat.successful += performer.successful
    stat.revenue += performer.revenue
    stat.incentive += performer.incentive
    departments.set(performer.department, stat)
  }

  const departmentStats = [...departments.values()]
    .map((stat) => ({ ...stat, conversionRate: rate(stat.successful, stat.total) }))
    .sort((a, b) => b.successful - a.successful || b.revenue - a.revenue)

  /* Trend + plan mix -------------------------------------------------- */
  const monthly = new Map<string, MonthlyStat>()
  const plans = new Map<string, { planName: string; successful: number; revenue: number }>()
  for (const row of rows) {
    const month = monthKey(row.createdAt)
    if (month) {
      const stat = monthly.get(month) || { month, total: 0, successful: 0, revenue: 0 }
      stat.total += 1
      if (row.isSuccessful) {
        stat.successful += 1
        stat.revenue += row.price
      }
      monthly.set(month, stat)
    }
    if (row.isSuccessful) {
      const plan = plans.get(row.planName) || { planName: row.planName, successful: 0, revenue: 0 }
      plan.successful += 1
      plan.revenue += row.price
      plans.set(row.planName, plan)
    }
  }

  /* Headline ---------------------------------------------------------- */
  const successful = rows.filter((row) => row.isSuccessful)
  const incentive = rows.reduce((sum, row) => sum + row.incentiveAmount, 0)
  const receivable = rows.reduce((sum, row) => sum + (row.isPaid ? 0 : row.incentiveAmount), 0)

  return {
    generatedAt: new Date().toISOString(),
    headline: {
      referrersWithCode: owners.size,
      referrersWithSale: topPerformers.filter((performer) => performer.successful > 0).length,
      total: rows.length,
      successful: successful.length,
      revenue: successful.reduce((sum, row) => sum + row.price, 0),
      incentive,
      receivable,
      conversionRate: rate(successful.length, rows.length),
      sharesTracked: shares.tracked,
      sharesConverted: shares.converted,
    },
    topPerformers,
    departments: departmentStats,
    monthly: [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-12),
    planMix: [...plans.values()].sort((a, b) => b.successful - a.successful),
  }
}

function rate(part: number, whole: number): number {
  return whole ? Math.round((part / whole) * 1000) / 10 : 0
}

// mysql2 hands back DATETIME columns as Date objects, but the same value
// arrives as an ISO string once it has been through JSON - accept both.
function monthKey(value: string | Date | null): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
