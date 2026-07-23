'use client'

import { useState } from 'react'
import { CheckCircle2, Clock, Filter, Inbox, MailCheck, ShieldCheck, Ticket, Users } from 'lucide-react'
import ReportView from '@/components/ReportView'
import LogoutButton from '@/components/LogoutButton'
import AddAdminForm from '@/components/AddAdminForm'
import NeedAttentionPanel from '@/components/NeedAttentionPanel'
import type { AdminOverviewStats } from '@/lib/db'
import type { CouponRequest, Employee } from '@/lib/types'

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
  currentAdminId,
  admins,
  overview,
  employeesNeedingCode,
  pendingRequests,
  activeEmployees,
}: {
  adminName: string
  currentAdminId: number
  admins: Employee[]
  overview: AdminOverviewStats
  employeesNeedingCode: Employee[]
  pendingRequests: PendingRequestRow[]
  activeEmployees: ActiveEmployee[]
}) {
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [adminList, setAdminList] = useState(admins)

  return (
    <main className="page">
      <div className="page-header fade-in">
        <h1>Referral Admin — {adminName.split(' ')[0]}</h1>
        <LogoutButton />
      </div>

      <div className="kpi-grid fade-in">
        <div className="kpi">
          <div className="kpi-icon" style={{ background: '#eef1fb', color: 'var(--navy)' }}>
            <Users size={17} />
          </div>
          <div className="value">{overview.totalEmployees}</div>
          <div className="label">Registered Employees</div>
        </div>
        <div className="kpi">
          <div className="kpi-icon" style={{ background: '#eef1fb', color: 'var(--navy)' }}>
            <Ticket size={17} />
          </div>
          <div className="value">{overview.couponsRequested}</div>
          <div className="label">Coupons Requested</div>
        </div>
        <div className="kpi">
          <div className="kpi-icon" style={{ background: 'var(--success-bg)', color: 'var(--navy)' }}>
            <CheckCircle2 size={17} />
          </div>
          <div className="value">{overview.couponsActive}</div>
          <div className="label">Coupons Approved &amp; Live</div>
        </div>
        <div className="kpi">
          <div className="kpi-icon" style={{ background: 'var(--warn-bg)', color: 'var(--navy)' }}>
            <Clock size={17} />
          </div>
          <div className="value">{overview.couponsPending}</div>
          <div className="label">Coupons Awaiting Activation</div>
        </div>
      </div>

      <NeedAttentionPanel employees={employeesNeedingCode} />

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
        <div className="card-title-row">
          <ShieldCheck size={20} />
          <h2>Admins ({adminList.length})</h2>
        </div>
        <p>Anyone added here gets full admin access the moment they sign in with that @nprep.in account.</p>
        <table className="referral-table" style={{ marginBottom: '1rem' }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {adminList.map((admin) => (
              <tr key={admin.id}>
                <td>
                  {admin.name}
                  {admin.id === currentAdminId ? <span className="status-chip success" style={{ marginLeft: '0.5rem' }}>You</span> : null}
                </td>
                <td>{admin.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <AddAdminForm
          onAdded={(employee) =>
            setAdminList((prev) => (prev.some((a) => a.id === employee.id) ? prev.map((a) => (a.id === employee.id ? employee : a)) : [...prev, employee]))
          }
        />
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
