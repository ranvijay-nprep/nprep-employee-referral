import { Award } from 'lucide-react'
import { getRateCardGroups } from '@/lib/incentives'

export default function IncentiveRateCard() {
  const groups = getRateCardGroups()

  return (
    <div className="card fade-in-delay-1">
      <div className="card-title-row">
        <Award size={20} />
        <h2>What you earn</h2>
      </div>
      <p>A flat incentive for every successful purchase made with your code:</p>
      <table className="referral-table rate-card-table">
        <thead>
          <tr>
            <th>Plan</th>
            <th>Payout by duration</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.label}>
              <td className="rate-card-plan-cell">{group.label}</td>
              <td>
                {group.tiers.map((tier) => (
                  <span key={tier.duration} className="rate-tier-chip">
                    <span className="rate-tier-duration">{tier.duration}</span>
                    <span className="rate-tier-amount">Rs. {tier.amount}</span>
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
