import { Award, Tag } from 'lucide-react'
import { getRateCard, STUDENT_DISCOUNT_PERCENT } from '@/lib/incentives'

export default function IncentiveRateCard() {
  const rows = getRateCard()

  return (
    <div className="card fade-in-delay-1">
      <div className="card-title-row">
        <Award size={20} />
        <h2>What you earn</h2>
      </div>

      <p className="student-discount-banner">
        <Tag size={16} />
        <span>
          Your code gives every student a flat <b>{STUDENT_DISCOUNT_PERCENT}% off</b> any NPrep plan.
        </span>
      </p>

      <p>And you earn a flat incentive on every successful purchase made with it:</p>
      <table className="referral-table rate-card-table">
        <thead>
          <tr>
            <th>Plan</th>
            <th>You earn</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="rate-card-plan-cell">
                <span className="rate-card-plan-name">{row.label}</span>
                <span className="rate-card-plan-covers">{row.covers}</span>
              </td>
              <td>
                <span className="rate-tier-chip">
                  <span className="rate-tier-amount">Rs. {row.amount}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
