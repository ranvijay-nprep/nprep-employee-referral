'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Clock, Filter, Inbox, MailCheck, Ticket, UserCheck, Users } from 'lucide-react'
import ReportView from '@/components/ReportView'
import LogoutButton from '@/components/LogoutButton'
import AdminsPanel from '@/components/AdminsPanel'
import MessageManager from '@/components/MessageManager'
import NeedAttentionPanel from '@/components/NeedAttentionPanel'
import ViewSwitch from '@/components/ViewSwitch'
import type { AdminOverviewStats, DirectoryEntry, PendingCouponRequest } from '@/lib/db'
import type { Employee, EmployeeWithProfile, MessageTemplate } from '@/lib/types'

interface ActiveEmployee {
  employeeId: number
  name: string
  code: string
  department: string | null
  designation: string | null
}

export default function AdminDashboard({
  adminName,
  currentAdminId,
  admins,
  overview,
  employeesNeedingCode,
  directoryOptions,
  pendingRequests,
  activeEmployees,
  messageTemplates,
}: {
  adminName: string
  currentAdminId: number
  admins: EmployeeWithProfile[]
  overview: AdminOverviewStats
  employeesNeedingCode: Employee[]
  directoryOptions: DirectoryEntry[]
  pendingRequests: PendingCouponRequest[]
  activeEmployees: ActiveEmployee[]
  messageTemplates: MessageTemplate[]
}) {
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')

  const departments = useMemo(
    () => [...new Set(activeEmployees.map((employee) => employee.department || 'Unassigned'))].sort(),
    [activeEmployees],
  )

  // Narrowing by department narrows the employee list too, so the two filters
  // can't end up contradicting each other on screen.
  const employeesInDepartment = useMemo(
    () =>
      departmentFilter
        ? activeEmployees.filter((employee) => (employee.department || 'Unassigned') === departmentFilter)
        : activeEmployees,
    [activeEmployees, departmentFilter],
  )

  // With a department picked but no single employee, the report still has to
  // be scoped - pass every employee id in that department.
  const reportEmployeeIds = employeeFilter
    ? [employeeFilter]
    : departmentFilter
      ? employeesInDepartment.map((employee) => String(employee.employeeId))
      : undefined

  return (
    <main className="page">
      <div className="page-header fade-in">
        <h1>Referral Admin — {adminName.split(' ')[0]}</h1>
        <div className="header-actions">
          <ViewSwitch current="admin" />
          <LogoutButton />
        </div>
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
        <div className="kpi">
          <div className="kpi-icon" style={{ background: '#eef1fb', color: 'var(--navy)' }}>
            <UserCheck size={17} />
          </div>
          <div className="value">{overview.refereesTracked}</div>
          <div className="label">Referees Tracked</div>
        </div>
      </div>

      <NeedAttentionPanel employees={employeesNeedingCode} directoryOptions={directoryOptions} />

      <div className="card fade-in">
        <div className="card-title-row">
          <MailCheck size={20} />
          <h2>Pending coupon requests ({pendingRequests.length})</h2>
        </div>
        <p>These have been emailed already - this list is just a fallback in case an email was missed.</p>
        {pendingRequests.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="referral-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Designation</th>
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
                    <td>{request.employeeDepartment || <span className="muted-cell">—</span>}</td>
                    <td>{request.employeeDesignation || <span className="muted-cell">—</span>}</td>
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
          </div>
        ) : (
          <div className="empty">
            <CheckCircle2 size={32} />
            Nothing pending - all caught up.
          </div>
        )}
      </div>

      <AdminsPanel admins={admins} currentAdminId={currentAdminId} />

      <MessageManager templates={messageTemplates} />

      <div className="card fade-in-delay-1">
        <div className="filter-row">
          <label>
            <Filter size={16} style={{ color: 'var(--muted)' }} />
            Department
            <select
              value={departmentFilter}
              onChange={(event) => {
                setDepartmentFilter(event.target.value)
                setEmployeeFilter('')
              }}
            >
              <option value="">All departments</option>
              {departments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </label>
          <label>
            Employee
            <select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}>
              <option value="">All employees</option>
              {employeesInDepartment.map((employee) => (
                <option key={employee.employeeId} value={employee.employeeId}>
                  {employee.name} ({employee.code})
                  {employee.designation ? ` — ${employee.designation}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!activeEmployees.length ? (
          <div className="empty">
            <Inbox size={28} />
            No employees have an active coupon yet.
          </div>
        ) : null}
      </div>

      <div className="fade-in-delay-2">
        <ReportView isAdmin employeeIds={reportEmployeeIds} />
      </div>
    </main>
  )
}
