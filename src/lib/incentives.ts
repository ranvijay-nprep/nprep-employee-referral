// Flat sales-incentive rate card, ported as-is from navigator-ts
// (server/referralReports.ts) - one flat amount per successful purchase,
// keyed on the plan (subscription_id) AND its duration in months.
interface IncentiveRule {
  sub: number
  months: number | '*'
  amount: number
}

const INCENTIVES: IncentiveRule[] = [
  { sub: 1, months: 12, amount: 250 },
  { sub: 2, months: 12, amount: 250 },
  { sub: 3, months: 12, amount: 400 },
  { sub: 17, months: 24, amount: 500 },
  { sub: 13, months: 12, amount: 500 },
  { sub: 13, months: 18, amount: 600 },
  { sub: 13, months: 24, amount: 700 },
  { sub: 9, months: 6, amount: 400 },
  { sub: 9, months: 7, amount: 400 },
  { sub: 9, months: 12, amount: 500 },
  { sub: 9, months: 24, amount: 700 },
  { sub: 4, months: 3, amount: 100 },
  { sub: 4, months: 6, amount: 150 },
  { sub: 8, months: '*', amount: 200 },
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
