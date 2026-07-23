// Flat sales-incentive rate card - one amount per successful purchase, keyed
// only on the plan (subscription_id). Duration no longer affects the payout:
// a 12-month and a 24-month Gold plan both earn the same. `TIERS` is the
// single source of truth for both the lookup logic below AND the
// employee-facing rate card display (src/components/IncentiveRateCard.tsx) -
// keeping them on one array means the two can never drift apart.
interface IncentiveTier {
  label: string
  // Plain-English list of what the tier covers, shown on the rate card so
  // employees can tell which of their sales falls where.
  covers: string
  amount: number
  subs: number[]
}

// Discount the student gets when they buy with an employee's code. Set on the
// coupon in NPrep itself - mirrored here only so the app can state it.
export const STUDENT_DISCOUNT_PERCENT = 40

const TIERS: IncentiveTier[] = [
  {
    label: 'College & Gold plans',
    covers: 'BSc 1st, 2nd, 3rd & 4th Year, BSc 3rd + 4th, and Gold - any duration',
    amount: 1200,
    subs: [1, 2, 3, 13, 17, 9],
  },
  {
    label: 'Rapid Revision',
    covers: 'Rapid Revision 2.0 - any duration',
    amount: 700,
    subs: [8],
  },
  {
    label: 'QBank & Test Series',
    covers: 'QBank + Test Series - any duration',
    amount: 500,
    subs: [4],
  },
]

export function incentiveForPurchase(planId: number | string): number {
  const sub = Number(planId)
  return TIERS.find((tier) => tier.subs.includes(sub))?.amount ?? 0
}

export interface RateCardRow {
  label: string
  covers: string
  amount: number
}

export function getRateCard(): RateCardRow[] {
  return TIERS.map(({ label, covers, amount }) => ({ label, covers, amount }))
}
