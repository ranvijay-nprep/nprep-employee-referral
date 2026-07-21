'use client'

import { useState } from 'react'
import { CheckCircle2, ShieldPlus, XCircle } from 'lucide-react'
import type { Employee } from '@/lib/types'

export default function AddAdminForm({ onAdded }: { onAdded: (employee: Employee) => void }) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)

  const submit = async () => {
    if (!email.trim()) return
    setSubmitting(true)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = (await response.json()) as { employee?: Employee; error?: string }
      if (!response.ok || !data.employee) throw new Error(data.error || 'Something went wrong')
      onAdded(data.employee)
      setMessage({ tone: 'ok', text: `${data.employee.email} is now an admin.` })
      setEmail('')
    } catch (err) {
      setMessage({ tone: 'bad', text: err instanceof Error ? err.message : 'Something went wrong' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="code-input-row">
      <input
        type="text"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && submit()}
        placeholder="someone@nprep.in"
      />
      <button className="primary" onClick={submit} disabled={!email.trim() || submitting}>
        {submitting ? (
          <>
            <span className="spinner" /> Adding…
          </>
        ) : (
          <>
            <ShieldPlus size={16} /> Add admin
          </>
        )}
      </button>
      {message ? (
        <p className={`availability-msg ${message.tone}`} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {message.tone === 'ok' ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
          {message.text}
        </p>
      ) : null}
    </div>
  )
}
