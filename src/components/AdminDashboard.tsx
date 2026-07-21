'use client'

import { useState } from 'react'
import { CheckCircle2, Filter, Inbox, MailCheck } from 'lucide-react'
import ReportView from '@/components/ReportView'
import LogoutButton from '@/components/LogoutButton'
import type { CouponRequest } from '@/lib/types'

interface PendingRequestRow extends CouponRequest {
  employeeName: string
  employeeEmail: string
}

interface ActiveEmployee {
  employeeId: number
  name: string
  code: string
}

export default function AdminDashboard({
  adminName,
  pendingRequests,
  activeEmployees,
}: {
  adminName: string
  pendingRequests: PendingRequestRow[]
  activeEmployees: ActiveEmployee[]
}) {
  const [employeeFilter, setEmployeeFilter] = useState('')

  return (
    <main className="page">
      <div className="page-header fade-in">
        <h1>Referral Admin — {adminName.split(' ')[0]}</h1>
        <LogoutButton />
      </div>

      <div className="card fade-in">
        <div className="card-title-row">
          <MailCheck size={20} />
          <h2>Pending coupon requests ({pendingRequests.length})</h2>
        </div>
        <p>These have been emailed already - this list is just a fallback in case an email was missed.</p>
        {pendingRequests.length ? (
          <table className="referral-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Code</th>
                <th>Usage limit</th>
                <th>Activation</th>
                <th>Expiry</th>
                <th>Requested</th>
              </tr>
            </thead>
            <tbody>
              {pendingRequests.map((request) => (
                <tr key={request.id}>
                  <td>
                    {request.employeeName}
                    <br />
                    <small>{request.employeeEmail}</small>
                  </td>
                  <td>
                    <b>{request.code}</b>
                  </td>
                  <td>{request.usage_limit}</td>
                  <td>{request.activation_date}</td>
                  <td>{request.expiry_date}</td>
                  <td>{new Date(request.requested_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty">
            <CheckCircle2 size={32} />
            Nothing pending - all caught up.
          </div>
        )}
      </div>

      <div className="card fade-in-delay-1">
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={16} style={{ color: 'var(--muted)' }} />
          Filter by employee
          <select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}>
            <option value="">All employees</option>
            {activeEmployees.map((employee) => (
              <option key={employee.employeeId} value={employee.employeeId}>
                {employee.name} ({employee.code})
              </option>
            ))}
          </select>
        </label>
        {!activeEmployees.length ? (
          <div className="empty">
            <Inbox size={28} />
            No employees have an active coupon yet.
          </div>
        ) : null}
      </div>

      <div className="fade-in-delay-2">
        <ReportView isAdmin employeeId={employeeFilter || undefined} />
      </div>
    </main>
  )
}
