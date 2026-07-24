'use client'

import { useState } from 'react'
import { AlertCircle, CheckCircle2, Link2 } from 'lucide-react'
import { buildEmployeeCouponCode } from '@/lib/couponCode'
import type { DirectoryEntry } from '@/lib/db'
import type { Employee } from '@/lib/types'

interface Row {
  id: number
  name: string
  email: string
}

// People who signed in but whose email wasn't found in the employee directory,
// so their code couldn't be assigned automatically (typically their directory
// row lists a personal email). The admin links them by PICKING their directory
// entry - codes are never typed; they always come from the directory.
export default function NeedAttentionPanel({
  employees,
  directoryOptions,
}: {
  employees: Employee[]
  directoryOptions: DirectoryEntry[]
}) {
  const [list, setList] = useState<Row[]>(employees.map((e) => ({ id: e.id, name: e.name, email: e.email })))
  const [options, setOptions] = useState(directoryOptions)
  const [picks, setPicks] = useState<Record<number, string>>({})
  const [busyId, setBusyId] = useState<number | null>(null)
  const [errors, setErrors] = useState<Record<number, string>>({})

  const setError = (id: number, value: string) => setErrors((prev) => ({ ...prev, [id]: value }))

  const approve = async (id: number) => {
    const employeeNo = picks[id] || ''
    if (!employeeNo) {
      setError(id, 'Pick their entry from the directory.')
      return
    }
    setBusyId(id)
    setError(id, '')
    try {
      const response = await fetch('/api/admin/employee-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: id, employeeNo }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error || 'Something went wrong')
      // Linked - drop the person, and retire the directory entry they took.
      setList((prev) => prev.filter((row) => row.id !== id))
      setOptions((prev) => prev.filter((option) => option.employee_no !== employeeNo))
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
        <h2>Need attention — unmatched sign-ins ({list.length})</h2>
      </div>
      <p>
        These people signed in but we couldn&apos;t match their email to the employee directory, so no code was assigned
        automatically. Pick their entry from the directory to link them — codes always come from the directory and are
        never typed by hand.
      </p>
      {list.length ? (
        <>
          {!options.length ? (
            <p className="availability-msg bad">
              No unassigned directory entries left — add them to the directory file first.
            </p>
          ) : null}
          {/* Without this the widened table (department + designation were
              added to it) pushes the action column clean outside the card. */}
          <div className="table-scroll">
            <table className="referral-table">
              <thead>
                <tr>
                  <th>Signed in as</th>
                  <th>Directory entry</th>
                  <th>Department &amp; designation</th>
                  <th>Referral coupon</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((row) => {
                  const picked = picks[row.id] || ''
                  const pickedEntry = options.find((option) => option.employee_no === picked)
                  return (
                    <tr key={row.id}>
                      <td>
                        {row.name}
                        <br />
                        <small>{row.email}</small>
                      </td>
                      <td>
                        <select
                          value={picked}
                          onChange={(event) => setPicks((prev) => ({ ...prev, [row.id]: event.target.value }))}
                        >
                          <option value="">Select employee…</option>
                          {options.map((option) => (
                            <option key={option.employee_no} value={option.employee_no}>
                              {option.employee_no} — {option.name}
                              {option.department ? ` · ${option.department}` : ''}
                              {option.email ? ` (${option.email})` : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {pickedEntry ? (
                          <>
                            {pickedEntry.department || '—'}
                            <br />
                            <small>{pickedEntry.designation || '—'}</small>
                          </>
                        ) : (
                          <span className="muted-cell">—</span>
                        )}
                      </td>
                      <td>
                        {picked ? <b>{buildEmployeeCouponCode(picked)}</b> : <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>
                      <td>
                        <button className="primary" onClick={() => approve(row.id)} disabled={busyId === row.id || !picked}>
                          {busyId === row.id ? (
                            <>
                              <span className="spinner" /> Linking…
                            </>
                          ) : (
                            <>
                              <Link2 size={16} /> Link &amp; approve
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
          </div>
        </>
      ) : (
        <div className="empty">
          <CheckCircle2 size={32} />
          Nothing needs attention — everyone signed in has been matched to the directory.
        </div>
      )}
    </div>
  )
}
