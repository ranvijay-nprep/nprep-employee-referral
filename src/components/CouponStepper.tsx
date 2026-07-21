import { Check } from 'lucide-react'
import type { CouponStatus } from '@/lib/types'

const STEPS = [
  { key: 'requested', label: 'Code requested' },
  { key: 'pending', label: 'Admin creating it in NPrep' },
  { key: 'active', label: 'Live & shareable' },
] as const

export default function CouponStepper({ status }: { status: CouponStatus }) {
  const activeIndex = status === 'active' ? 2 : status === 'pending' ? 1 : 0

  return (
    <div className="stepper">
      {STEPS.map((step, index) => {
        const isDone = index < activeIndex || (status === 'active' && index <= activeIndex)
        const isActive = index === activeIndex && status !== 'active'
        return (
          <div key={step.key} className={`stepper-step ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}>
            <span className="stepper-line" />
            <span className="stepper-dot">{isDone ? <Check size={16} /> : index + 1}</span>
            <span className="stepper-label">{step.label}</span>
          </div>
        )
      })}
    </div>
  )
}
