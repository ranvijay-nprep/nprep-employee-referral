'use client'

import { useState } from 'react'
import { AlertCircle, CheckCircle2, UserPlus } from 'lucide-react'
import { buildEmployeeCouponCode, normalizeEmployeeCode } from '@/lib/couponCode'
import type { Employee } from '@/lib/types'

interface Row {
  id: number
  name: string
  email: string
}

// Admin panel listing employees who've signed in but have no employee code
// yet. The admin types each one's internal code, sees the resulting NPrep…
// coupon previewed live, and approves - which sets the code and creates the
// coupon request in one step (see /api/admin/employee-code).
export default function NeedAttentionPanel({ employees }: { employees: Employee[] }) {
  const [list, setList] = useState<Row[]>(employees.map((e) => ({ id: e.id, name: e.name, email: e.email })))
  const [codes, setCodes] = useState<Record<number, string>>({})
  const [busyId, setBusyId] = useState<number | null>(null)
  const [errors, setErrors] = useState<Record<number, string>>({})

  const setCode = (id: number, value: string) => setCodes((prev) => ({ ...prev, [id]: value }))
  const setError = (id: number, value: string) => setErrors((prev) => ({ ...prev, [id]: value }))

  const approve = async (id: number) => {
    const employeeCode = normalizeEmployeeCode(codes[id] || '')
    if (!employeeCode) {
      setError(id, 'Enter a code (letters/numbers).')
      return
    }
    setBusyId(id)
    setError(id, '')
    try {
      const response = await fetch('/api/admin/employee-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: id, employeeCode }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error || 'Something went wrong')
      // Approved - drop the row; it now shows up under "Pending coupon requests".
      setList((prev) => prev.filter((row) => row.id !== id))
    } catch (err) {
      setError(id, err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="card fade-in">
      <div className="card-title-row">
        <AlertCircle size={20} />
        <h2>Need attention — employees without a code ({list.length})</h2>
      </div>
      <p>
        These employees have signed in but don&apos;t have an employee code yet. Add each one&apos;s code to generate their{' '}
        <b>NPrep…</b> referral coupon.
      </p>
      {list.length ? (
        <table className="referral-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Employee code</th>
              <th>Referral coupon</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((row) => {
              const preview = normalizeEmployeeCode(codes[row.id] || '')
              return (
                <tr key={row.id}>
                  <td>
                    {row.name}
                    <br />
                    <small>{row.email}</small>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={codes[row.id] || ''}
                      onChange={(event) => setCode(row.id, event.target.value)}
                      onKeyDown={(event) => event.key === 'Enter' && approve(row.id)}
                      placeholder="e.g. 042"
                      maxLength={20}
                      style={{ maxWidth: '10rem' }}
                    />
                  </td>
                  <td>{preview ? <b>{buildEmployeeCouponCode(preview)}</b> : <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                  <td>
                    <button className="primary" onClick={() => approve(row.id)} disabled={busyId === row.id || !preview}>
                      {busyId === row.id ? (
                        <>
                          <span className="spinner" /> Approving…
                        </>
                      ) : (
                        <>
                          <UserPlus size={16} /> Approve
                        </>
                      )}
                    </button>
                    {errors[row.id] ? (
                      <p className="availability-msg bad" style={{ marginTop: '0.4rem' }}>
                        {errors[row.id]}
                      </p>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : (
        <div className="empty">
          <CheckCircle2 size={32} />
          Nothing needs attention — every employee has a code.
        </div>
      )}
    </div>
  )
}
