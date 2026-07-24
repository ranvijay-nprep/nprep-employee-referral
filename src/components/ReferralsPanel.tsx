'use client'

import { useMemo, useState } from 'react'
import { Filter, Inbox } from 'lucide-react'
import ReportView from '@/components/ReportView'

export interface ActiveEmployee {
  employeeId: number
  name: string
  code: string
  department: string | null
  designation: string | null
}

export default function ReferralsPanel({ activeEmployees }: { activeEmployees: ActiveEmployee[] }) {
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
    <>
      <header className="admin-page-header">
        <h1>Referrals &amp; payouts</h1>
        <p>Every purchase made on an employee coupon, and what each one owes in incentive.</p>
      </header>

      <div className="card fade-in">
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

      <div className="fade-in-delay-1">
        <ReportView isAdmin employeeIds={reportEmployeeIds} />
      </div>
    </>
  )
}
