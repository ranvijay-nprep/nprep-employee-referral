'use client'

import { useState } from 'react'
import { AlertCircle, ShieldCheck, UserMinus } from 'lucide-react'
import AddAdminForm from '@/components/AddAdminForm'
import type { EmployeeWithProfile } from '@/lib/types'

// The admin roster: who has full access, plus the add/remove controls.
// Removing only drops the role - the person keeps their referral code and
// every purchase already attributed to them, and simply lands on the referrer
// dashboard next time they sign in.
export default function AdminsPanel({
  admins,
  currentAdminId,
}: {
  admins: EmployeeWithProfile[]
  currentAdminId: number
}) {
  const [list, setList] = useState(admins)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState('')

  const remove = async (admin: EmployeeWithProfile) => {
    if (!window.confirm(`Remove admin access for ${admin.name} (${admin.email})?\n\nThey keep their referral code and past referrals.`)) {
      return
    }
    setBusyId(admin.id)
    setError('')
    try {
      const response = await fetch('/api/admin/demote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: admin.id }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error || 'Something went wrong')
      setList((prev) => prev.filter((row) => row.id !== admin.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="card fade-in-delay-1">
      <div className="card-title-row">
        <ShieldCheck size={20} />
        <h2>Admins ({list.length})</h2>
      </div>
      <p>Anyone added here gets full admin access the moment they sign in with that @nprep.in account.</p>

      {error ? (
        <div className="error-banner">
          <AlertCircle size={16} /> {error}
        </div>
      ) : null}

      <div style={{ overflowX: 'auto' }}>
        <table className="referral-table" style={{ marginBottom: '1rem' }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Designation</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((admin) => (
              <tr key={admin.id}>
                <td>
                  {admin.name}
                  {admin.id === currentAdminId ? (
                    <span className="status-chip success" style={{ marginLeft: '0.5rem' }}>
                      You
                    </span>
                  ) : null}
                </td>
                <td>{admin.email}</td>
                <td>{admin.department || <span className="muted-cell">—</span>}</td>
                <td>{admin.designation || <span className="muted-cell">—</span>}</td>
                <td style={{ textAlign: 'right' }}>
                  {admin.id === currentAdminId ? (
                    // Blocked in the API too - this just avoids offering a
                    // button that can only ever fail.
                    <span className="muted-cell">—</span>
                  ) : (
                    <button className="danger" onClick={() => remove(admin)} disabled={busyId === admin.id || list.length <= 1}>
                      {busyId === admin.id ? (
                        <>
                          <span className="spinner" /> Removing…
                        </>
                      ) : (
                        <>
                          <UserMinus size={16} /> Remove
                        </>
                      )}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddAdminForm
        onAdded={(employee) =>
          setList((prev) =>
            prev.some((row) => row.id === employee.id)
              ? prev.map((row) => (row.id === employee.id ? employee : row))
              : [...prev, employee],
          )
        }
      />
    </div>
  )
}
