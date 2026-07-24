import { CheckCircle2, Clock, MailCheck, Ticket, UserCheck, Users } from 'lucide-react'
import {
  getAdminOverviewStats,
  getEmployeesNeedingCode,
  getPendingCouponRequests,
  getUnassignedDirectory,
} from '@/lib/db'
import { formatDate, formatDateTime } from '@/lib/dates'
import NeedAttentionPanel from '@/components/NeedAttentionPanel'

// The daily-driver page: what needs doing, and the queue it needs doing to.
// Settings (admins, message copy) moved out to their own sidebar sections.
export default async function AdminOverviewPage() {
  const overview = getAdminOverviewStats()
  const employeesNeedingCode = getEmployeesNeedingCode()
  const directoryOptions = getUnassignedDirectory()
  const pendingRequests = getPendingCouponRequests()

  return (
    <>
      <header className="admin-page-header">
        <h1>Overview</h1>
        <p>Coupons waiting on a human, and where the programme stands overall.</p>
      </header>

      <div className="kpi-grid fade-in">
        <Kpi icon={<Users size={17} />} value={overview.totalEmployees} label="Registered People" />
        <Kpi icon={<Ticket size={17} />} value={overview.couponsRequested} label="Coupons Requested" />
        <Kpi icon={<CheckCircle2 size={17} />} value={overview.couponsActive} label="Coupons Live" tint="var(--success-bg)" />
        <Kpi icon={<Clock size={17} />} value={overview.couponsPending} label="Awaiting Activation" tint="var(--warn-bg)" />
        <Kpi icon={<UserCheck size={17} />} value={overview.refereesTracked} label="Referees Tracked" />
      </div>

      <NeedAttentionPanel employees={employeesNeedingCode} directoryOptions={directoryOptions} />

      <div className="card fade-in">
        <div className="card-title-row">
          <MailCheck size={20} />
          <h2>Pending coupon requests ({pendingRequests.length})</h2>
        </div>
        <p>
          Each of these needs the coupon creating in NPrep with these exact details. Every admin was emailed already —
          this list is the fallback in case one was missed.
        </p>
        {pendingRequests.length ? (
          <div className="table-scroll">
            <table className="referral-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Code</th>
                  <th className="num">Usage limit</th>
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
                    <td className="num">{request.usage_limit}</td>
                    <td>{formatDate(request.activation_date)}</td>
                    <td>{formatDate(request.expiry_date)}</td>
                    <td>{formatDateTime(request.requested_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <CheckCircle2 size={32} />
            Nothing pending — all caught up.
          </div>
        )}
      </div>
    </>
  )
}

function Kpi({ icon, value, label, tint = '#eef1fb' }: { icon: React.ReactNode; value: number; label: string; tint?: string }) {
  return (
    <div className="kpi">
      <div className="kpi-icon" style={{ background: tint, color: 'var(--navy)' }}>
        {icon}
      </div>
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  )
}
