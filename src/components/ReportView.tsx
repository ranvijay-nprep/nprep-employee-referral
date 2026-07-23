'use client'

import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  IndianRupee,
  Inbox,
  ShoppingBag,
  Upload,
  Wallet,
  XCircle,
} from 'lucide-react'
import type { ReferralRow, ReferralSummary } from '@/lib/types'
import { buildPayoutCsv, downloadCsv, extractPaidPurchaseIds } from '@/lib/csv'

interface ReportResponse {
  rows: ReferralRow[]
  summary: ReferralSummary
}

export default function ReportView({
  isAdmin,
  employeeIds,
  personal,
}: {
  isAdmin: boolean
  // Zero or more employees to scope an admin report to. Undefined/empty means
  // "everyone with an active coupon".
  employeeIds?: string[]
  personal?: boolean
}) {
  const [data, setData] = useState<ReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('all')
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [importSummary, setImportSummary] = useState<{ requested: number; marked: number; alreadyPaid: number; invalid: number[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // The parent rebuilds `employeeIds` on every render, so the effect below
  // depends on its VALUE, not the array identity - otherwise it would refetch
  // in a loop.
  const employeeKey = (employeeIds || []).join(',')

  const load = async () => {
    setError('')
    setLoading(true)
    try {
      const params = new URLSearchParams({ status })
      if (employeeKey) params.set('employeeIds', employeeKey)
      if (personal) params.set('scope', 'self')
      const response = await fetch(`/api/report?${params}`)
      if (!response.ok) throw new Error(await response.text())
      setData((await response.json()) as ReportResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, employeeKey])

  const markPaid = async (purchaseId: number) => {
    setBusyId(purchaseId)
    try {
      const response = await fetch(`/api/payouts/${purchaseId}/paid`, { method: 'POST' })
      if (!response.ok) throw new Error(await response.text())
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark paid')
    } finally {
      setBusyId(null)
    }
  }

  const downloadPayoutCsv = async () => {
    setError('')
    setImportSummary(null)
    try {
      const response = await fetch('/api/report?status=successful')
      if (!response.ok) throw new Error(await response.text())
      const report = (await response.json()) as ReportResponse
      const rows = report.rows.filter((row) => row.isSuccessful && row.incentiveAmount > 0)
      if (!rows.length) {
        setError('No successful incentivised transactions found.')
        return
      }
      downloadCsv(buildPayoutCsv(rows), `incentive-payouts-${new Date().toISOString().slice(0, 10)}.csv`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to build CSV')
    }
  }

  const uploadPayoutCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    setError('')
    setImportSummary(null)
    try {
      const purchaseIds = extractPaidPurchaseIds(await file.text())
      if (!purchaseIds.length) {
        setError('No rows marked "Paid" were found in this file.')
        return
      }
      const response = await fetch('/api/payouts/bulk-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseIds }),
      })
      if (!response.ok) throw new Error(await response.text())
      setImportSummary(await response.json())
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import CSV')
    }
  }

  const summary = data?.summary
  const showSkeleton = loading && !data

  return (
    <div>
      {error ? (
        <div className="error-banner">
          <AlertCircle size={16} /> {error}
        </div>
      ) : null}

      <div className="kpi-grid">
        <Kpi icon={<ShoppingBag size={17} />} tint="#eef1fb" label="Total Purchases" hint="All purchases made using this code, any status" value={summary?.total ?? 0} loading={showSkeleton} />
        <Kpi icon={<CheckCircle2 size={17} />} tint="var(--success-bg)" label="Successful Purchases" hint="Purchases that went through completely" value={summary?.successful ?? 0} loading={showSkeleton} />
        <Kpi icon={<Clock size={17} />} tint="var(--warn-bg)" label="Awaiting Confirmation" hint="Student started checkout but payment isn't confirmed yet" value={summary?.pending ?? 0} loading={showSkeleton} />
        <Kpi icon={<XCircle size={17} />} tint="var(--danger-bg)" label="Failed Purchases" hint="Purchases that did not go through" value={summary?.failed ?? 0} loading={showSkeleton} />
        <Kpi icon={<IndianRupee size={17} />} tint="#eef1fb" label="Total Incentive Earned" hint="Incentive earned from all successful purchases" value={`Rs. ${summary?.incentive ?? 0}`} loading={showSkeleton} />
        <Kpi icon={<Wallet size={17} />} tint="var(--warn-bg)" label="Incentive Not Yet Paid" hint="Earned but admin hasn't marked it paid yet" value={`Rs. ${summary?.receivable ?? 0}`} loading={showSkeleton} />
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="successful">Successful</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>

          {isAdmin ? (
            <>
              <button className="secondary" onClick={downloadPayoutCsv}>
                <Download size={16} /> Download CSV
              </button>
              <button className="secondary" onClick={() => fileRef.current?.click()}>
                <Upload size={16} /> Upload CSV
              </button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={uploadPayoutCsv} />
            </>
          ) : null}

          {loading && data ? (
            <span style={{ color: 'var(--muted)', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span className="spinner" /> Updating…
            </span>
          ) : null}
        </div>

        {importSummary ? (
          <p className="toast-success" style={{ marginTop: '0.85rem', marginBottom: 0 }}>
            <CheckCircle2 size={16} />
            Marked {importSummary.marked} paid, {importSummary.alreadyPaid} already paid, {importSummary.invalid.length} invalid.
          </p>
        ) : null}

        <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
          <table className="referral-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Plan</th>
                {isAdmin ? <th>Employee</th> : null}
                {isAdmin ? <th>Department</th> : null}
                <th>Purchase Amount</th>
                <th>Purchase Status</th>
                <th>Incentive Earned</th>
                {isAdmin ? <th></th> : null}
              </tr>
            </thead>
            <tbody>
              {showSkeleton
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} isAdmin={isAdmin} />)
                : (data?.rows || []).map((row, index) => (
                    <tr key={row.purchaseId} className="fade-in" style={{ animationDelay: `${Math.min(index, 8) * 0.03}s` }}>
                      <td>
                        {row.studentName}
                        <br />
                        <small>{row.studentPhone}</small>
                      </td>
                      <td>
                        {row.planName} {row.planDuration}
                      </td>
                      {isAdmin ? (
                        <td>
                          {row.employeeName || '—'}
                          {row.employeeDesignation ? (
                            <>
                              <br />
                              <small>{row.employeeDesignation}</small>
                            </>
                          ) : null}
                        </td>
                      ) : null}
                      {isAdmin ? <td>{row.employeeDepartment || <span className="muted-cell">—</span>}</td> : null}
                      <td>Rs. {row.price}</td>
                      <td>
                        <StatusChip row={row} />
                      </td>
                      <td>
                        Rs. {row.incentiveAmount}
                        {row.incentiveAmount ? (
                          <span className={`status-chip ${row.isPaid ? 'success' : 'pending'}`} style={{ marginLeft: '0.4rem' }}>
                            {row.isPaid ? 'Paid' : 'Payment due'}
                          </span>
                        ) : null}
                      </td>
                      {isAdmin ? (
                        <td>
                          {row.isSuccessful && row.incentiveAmount > 0 && !row.isPaid ? (
                            <button className="secondary" onClick={() => markPaid(row.purchaseId)} disabled={busyId === row.purchaseId}>
                              {busyId === row.purchaseId ? (
                                <>
                                  <span className="spinner" /> Marking…
                                </>
                              ) : (
                                'Mark Paid'
                              )}
                            </button>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  ))}
            </tbody>
          </table>
          {!showSkeleton && !data?.rows.length ? (
            <div className="empty">
              <Inbox size={32} />
              No referrals found for this filter.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function StatusChip({ row }: { row: ReferralRow }) {
  const tone = row.isSuccessful ? 'success' : row.status === 'Failed' ? 'failed' : 'pending'
  const Icon = row.isSuccessful ? CheckCircle2 : row.status === 'Failed' ? XCircle : Clock
  return (
    <span className={`status-chip ${tone}`}>
      <Icon size={12} />
      {row.isSuccessful ? 'Successful' : row.status}
    </span>
  )
}

function SkeletonRow({ isAdmin }: { isAdmin: boolean }) {
  return (
    <tr>
      <td>
        <div className="skeleton" style={{ height: '0.9rem', width: '70%', marginBottom: '0.3rem' }} />
        <div className="skeleton" style={{ height: '0.7rem', width: '50%' }} />
      </td>
      <td>
        <div className="skeleton" style={{ height: '0.9rem', width: '80%' }} />
      </td>
      {isAdmin ? (
        <td>
          <div className="skeleton" style={{ height: '0.9rem', width: '60%' }} />
        </td>
      ) : null}
      {isAdmin ? (
        <td>
          <div className="skeleton" style={{ height: '0.9rem', width: '55%' }} />
        </td>
      ) : null}
      <td>
        <div className="skeleton" style={{ height: '0.9rem', width: '50%' }} />
      </td>
      <td>
        <div className="skeleton" style={{ height: '1.2rem', width: '70%', borderRadius: '999px' }} />
      </td>
      <td>
        <div className="skeleton" style={{ height: '0.9rem', width: '60%' }} />
      </td>
      {isAdmin ? <td /> : null}
    </tr>
  )
}

function Kpi({
  label,
  value,
  hint,
  icon,
  tint,
  loading,
}: {
  label: string
  value: string | number
  hint?: string
  icon: React.ReactNode
  tint: string
  loading?: boolean
}) {
  if (loading) {
    return (
      <div className="kpi kpi-skeleton">
        <div className="skeleton value" />
        <div className="skeleton label" />
      </div>
    )
  }
  return (
    <div className="kpi" title={hint}>
      <div className="kpi-icon" style={{ background: tint, color: 'var(--navy)' }}>
        {icon}
      </div>
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  )
}
