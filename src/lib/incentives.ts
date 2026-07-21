// Flat sales-incentive rate card, ported from navigator-ts
// (server/referralReports.ts) - one flat amount per successful purchase,
// keyed on the plan (subscription_id) AND its duration in months. `label` is
// the single source of truth for both the lookup logic below AND the
// employee-facing rate card display (src/components/IncentiveRateCard.tsx) -
// keeping them on one array means the two can never drift apart.
interface IncentiveRule {
  sub: number
  months: number | '*'
  amount: number
  label: string
}

const INCENTIVES: IncentiveRule[] = [
  { sub: 1, months: 12, amount: 250, label: 'BSc 1st Year' },
  { sub: 2, months: 12, amount: 250, label: 'BSc 2nd Year' },
  { sub: 3, months: 12, amount: 400, label: 'BSc 3rd Year' },
  { sub: 17, months: 24, amount: 500, label: 'BSc 3rd + 4th Year' },
  { sub: 13, months: 12, amount: 500, label: 'BSc 4th Year' },
  { sub: 13, months: 18, amount: 600, label: 'BSc 4th Year' },
  { sub: 13, months: 24, amount: 700, label: 'BSc 4th Year' },
  { sub: 9, months: 6, amount: 400, label: 'Gold' },
  { sub: 9, months: 7, amount: 400, label: 'Gold' },
  { sub: 9, months: 12, amount: 500, label: 'Gold' },
  { sub: 9, months: 24, amount: 700, label: 'Gold' },
  { sub: 4, months: 3, amount: 100, label: 'QBank + Test Series' },
  { sub: 4, months: 6, amount: 150, label: 'QBank + Test Series' },
  { sub: 8, months: '*', amount: 200, label: 'Rapid Revision 2.0' },
]

function durationToMonths(unit: string | null | undefined, duration: number | string | null | undefined): number {
  const value = Number(duration) || 0
  switch (String(unit || '').toLowerCase()) {
    case 'year':
      return value * 12
    case 'month':
      return value
    default:
      return -1
  }
}

export function incentiveForPurchase(planId: number | string, unit: string | null | undefined, duration: number | string | null | undefined): number {
  const sub = Number(planId)
  const months = durationToMonths(unit, duration)
  for (const rule of INCENTIVES) {
    if (rule.sub !== sub) continue
    if (rule.months === '*' || rule.months === months) return rule.amount
  }
  return 0
}

export interface RateCardTier {
  duration: string
  amount: number
}

export interface RateCardGroup {
  label: string
  tiers: RateCardTier[]
}

// One row per plan (not per rule) - each row lists all of that plan's
// duration tiers together, e.g. "BSc 4th Year: 12mo Rs.500 / 18mo Rs.600 /
// 24mo Rs.700" as one line, instead of 3 near-identical tiles. Tiers with
// the same payout (e.g. Gold's legacy 6-month vs current 7-month SKU) merge
// into a single tier rather than showing as two separate offers.
export function getRateCardGroups(): RateCardGroup[] {
  const byLabel = new Map<string, Map<number, string[]>>()
  for (const rule of INCENTIVES) {
    const duration = rule.months === '*' ? 'Any duration' : `${rule.months} month${rule.months === 1 ? '' : 's'}`
    if (!byLabel.has(rule.label)) byLabel.set(rule.label, new Map())
    const byAmount = byLabel.get(rule.label)!
    if (!byAmount.has(rule.amount)) byAmount.set(rule.amount, [])
    byAmount.get(rule.amount)!.push(duration)
  }

  return [...byLabel.entries()]
    .map(([label, byAmount]) => ({
      label,
      tiers: [...byAmount.entries()]
        .map(([amount, durations]) => ({ duration: durations.join(' / '), amount }))
        .sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => Math.max(...b.tiers.map((t) => t.amount)) - Math.max(...a.tiers.map((t) => t.amount)))
}
