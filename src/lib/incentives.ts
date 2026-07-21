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

export interface RateCardRow {
  label: string
  duration: string
  amount: number
}

// Groups rules by (label, amount) so identical-payout tiers with different
// underlying SKUs (e.g. Gold's legacy 6-month vs current 7-month) collapse
// into a single display row instead of looking like two separate offers.
export function getRateCardRows(): RateCardRow[] {
  const merged = new Map<string, { label: string; durations: string[]; amount: number }>()
  for (const rule of INCENTIVES) {
    const key = `${rule.label}__${rule.amount}`
    const duration = rule.months === '*' ? 'Any duration' : `${rule.months} month${rule.months === 1 ? '' : 's'}`
    const entry = merged.get(key)
    if (entry) entry.durations.push(duration)
    else merged.set(key, { label: rule.label, durations: [duration], amount: rule.amount })
  }
  return [...merged.values()]
    .map((entry) => ({ label: entry.label, duration: entry.durations.join(' / '), amount: entry.amount }))
    .sort((a, b) => b.amount - a.amount)
}
