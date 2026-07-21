import { Award } from 'lucide-react'
import { getRateCardRows } from '@/lib/incentives'

export default function IncentiveRateCard() {
  const rows = getRateCardRows()

  return (
    <div className="card fade-in-delay-1">
      <div className="card-title-row">
        <Award size={20} />
        <h2>What you earn</h2>
      </div>
      <p>A flat incentive for every successful purchase made with your code:</p>
      <div className="rate-card-grid">
        {rows.map((row) => (
          <div key={`${row.label}-${row.duration}`} className="rate-card-tile">
            <div className="rate-card-plan">{row.label}</div>
            <div className="rate-card-duration">{row.duration}</div>
            <div className="rate-card-amount">Rs. {row.amount}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
