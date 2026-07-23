'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { buildEmployeeCouponCode, normalizeEmployeeCode } from '@/lib/couponCode'

// Shown on an ADMIN's own referrer dashboard when they don't have a code yet.
// Admins are trusted to set codes (they assign them to employees too), so they
// self-serve their own here instead of appearing in the "Need attention" panel.
// Posts to the same admin endpoint with their own id, then reloads so the
// server re-renders with the freshly-created pending coupon.
export default function SetMyCodeForm({ employeeId }: { employeeId: number }) {
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const preview = normalizeEmployeeCode(value)

  const submit = async () => {
    if (!preview) {
      setError('Enter your employee code (letters/numbers).')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/admin/employee-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, employeeCode: preview }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error || 'Something went wrong')
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <div className="card">
      <div className="card-title-row">
        <Sparkles size={20} />
        <h2>Generate your referral code</h2>
      </div>
      <p>
        As an admin you can set your own employee code. Your referral coupon will be <b>NPrep</b> + your code.
      </p>
      <div className="code-input-row">
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && submit()}
          placeholder="e.g. 042"
          maxLength={20}
          style={{ maxWidth: '10rem' }}
        />
        <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          →&nbsp;<b style={{ color: 'var(--navy)' }}>{preview ? buildEmployeeCouponCode(preview) : 'NPrep…'}</b>
        </span>
        <button className="primary" onClick={submit} disabled={!preview || submitting}>
          {submitting ? (
            <>
              <span className="spinner" /> Creating…
            </>
          ) : (
            'Create my code'
          )}
        </button>
      </div>
      {error ? <p className="availability-msg bad">{error}</p> : null}
    </div>
  )
}
