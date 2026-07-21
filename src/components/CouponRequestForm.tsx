'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Sparkles, XCircle } from 'lucide-react'
import type { CouponRequest } from '@/lib/types'

interface AvailabilityResponse {
  available: boolean
  code: string
  reason?: string
  suggestions: string[]
}

export default function CouponRequestForm({ onCreated }: { onCreated: (request: CouponRequest) => void }) {
  const [value, setValue] = useState('')
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null)
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) {
      setAvailability(null)
      return
    }
    setChecking(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/coupons/check-availability?code=${encodeURIComponent(value)}`)
        setAvailability((await response.json()) as AvailabilityResponse)
      } catch {
        setAvailability(null)
      } finally {
        setChecking(false)
      }
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value])

  const submit = async () => {
    if (!availability?.available) return
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/coupons/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: availability.code }),
      })
      const data = (await response.json()) as { request?: CouponRequest; error?: string }
      if (!response.ok || !data.request) throw new Error(data.error || 'Something went wrong')
      onCreated(data.request)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card">
      <div className="card-title-row">
        <Sparkles size={20} />
        <h2>Create your referral code</h2>
      </div>
      <p>Pick something short and memorable - like your name. You can&apos;t change it once it&apos;s created.</p>
      <div className="code-input-row">
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && submit()}
          placeholder="e.g. RIYA"
          maxLength={12}
          style={{
            borderColor: availability ? (availability.available ? 'var(--success-fg)' : 'var(--danger-fg)') : undefined,
          }}
        />
        <button className="primary" onClick={submit} disabled={!availability?.available || submitting}>
          {submitting ? (
            <>
              <span className="spinner" /> Creating…
            </>
          ) : (
            'Create code'
          )}
        </button>
      </div>
      {checking ? (
        <p className="availability-msg">
          <span className="spinner" /> Checking…
        </p>
      ) : null}
      {!checking && availability ? (
        <p className={`availability-msg ${availability.available ? 'ok' : 'bad'}`} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {availability.available ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
          {availability.available ? `"${availability.code}" is available!` : availability.reason}
        </p>
      ) : null}
      {!checking && availability && !availability.available && availability.suggestions.length ? (
        <div className="suggestions">
          {availability.suggestions.map((suggestion) => (
            <span key={suggestion} className="suggestion-chip" onClick={() => setValue(suggestion)}>
              {suggestion}
            </span>
          ))}
        </div>
      ) : null}
      {error ? <p className="availability-msg bad">{error}</p> : null}
    </div>
  )
}
