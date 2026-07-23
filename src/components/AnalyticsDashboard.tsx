'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  Award,
  BarChart3,
  Building2,
  CalendarDays,
  IndianRupee,
  Layers,
  Loader2,
  ShoppingBag,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react'
import LogoutButton from '@/components/LogoutButton'
import ViewSwitch from '@/components/ViewSwitch'
import type { AnalyticsPayload } from '@/lib/types'

// Every chart here plots ONE series, so each is a single-hue magnitude
// comparison (no legend needed - the heading names what is plotted) and every
// chart is paired with the table that carries the exact numbers.
const RANGES = [
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '90', label: 'Last 90 days', days: 90 },
  { key: '365', label: 'Last 12 months', days: 365 },
  { key: 'all', label: 'All time', days: 0 },
] as const

export default function AnalyticsDashboard({ adminName }: { adminName: string }) {
  const [range, setRange] = useState<string>('90')
  const [data, setData] = useState<AnalyticsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      const days = RANGES.find((option) => option.key === range)?.days ?? 0
      if (days) {
        const from = new Date()
        from.setDate(from.getDate() - days)
        params.set('fromDate', from.toISOString().slice(0, 10))
      }
      const response = await fetch(`/api/admin/analytics?${params}`)
      const payload = (await response.json()) as AnalyticsPayload & { error?: string }
      if (!response.ok) throw new Error(payload.error || 'Failed to load analytics')
      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    load()
  }, [load])

  const headline = data?.headline

  return (
    <main className="page">
      <div className="page-header fade-in">
        <div>
          <h1>Referral Analytics</h1>
          <div className="profile-chips">
            <span className="profile-chip">
              <BarChart3 size={13} /> {adminName.split(' ')[0]}&apos;s view
            </span>
          </div>
        </div>
        <div className="header-actions">
          <ViewSwitch current="analytics" />
          <LogoutButton />
        </div>
      </div>

      <div className="card fade-in">
        <div className="filter-row">
          <label>
            <CalendarDays size={16} style={{ color: 'var(--muted)' }} />
            Period
            <select value={range} onChange={(event) => setRange(event.target.value)}>
              {RANGES.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {loading ? (
            <span className="muted-cell" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span className="spinner" /> Updating…
            </span>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="error-banner">
          <AlertCircle size={16} /> {error}
        </div>
      ) : null}

      {!data && loading ? (
        <div className="card">
          <div className="empty">
            <Loader2 size={30} /> Crunching the numbers…
          </div>
        </div>
      ) : null}

      {headline ? (
        <>
          <div className="kpi-grid fade-in">
            <Stat icon={<ShoppingBag size={17} />} label="Successful Sales" value={headline.successful} />
            <Stat icon={<IndianRupee size={17} />} label="Revenue Generated" value={`Rs. ${format(headline.revenue)}`} />
            <Stat icon={<Award size={17} />} label="Incentive Earned" value={`Rs. ${format(headline.incentive)}`} tint="var(--success-bg)" />
            <Stat icon={<TrendingUp size={17} />} label="Checkout Conversion" value={`${headline.conversionRate}%`} hint={`${headline.successful} of ${headline.total} purchase attempts completed`} />
            <Stat icon={<Users size={17} />} label="Referrers With A Code" value={headline.referrersWithCode} />
            <Stat
              icon={<UserCheck size={17} />}
              label="Referrers Who Sold"
              value={headline.referrersWithSale}
              hint="Employees with at least one successful sale in this period"
              tint="var(--success-bg)"
            />
          </div>

          {headline.sharesTracked ? (
            <div className="card fade-in">
              <div className="card-title-row">
                <UserCheck size={20} />
                <h2>Referee tracker</h2>
              </div>
              <p>
                Across everyone, <b>{headline.sharesTracked}</b> {headline.sharesTracked === 1 ? 'person has' : 'people have'} been
                sent a coupon directly, and <b>{headline.sharesConverted}</b> of them bought —{' '}
                <b>{headline.sharesTracked ? Math.round((headline.sharesConverted / headline.sharesTracked) * 100) : 0}%</b>{' '}
                of tracked shares converted.
              </p>
            </div>
          ) : null}

          <div className="card fade-in">
            <div className="card-title-row">
              <Award size={20} />
              <h2>Top performers — successful sales</h2>
            </div>
            {data.topPerformers.some((performer) => performer.successful > 0) ? (
              <BarList
                rows={data.topPerformers
                  .filter((performer) => performer.successful > 0)
                  .slice(0, 10)
                  .map((performer) => ({
                    key: String(performer.employeeId),
                    label: performer.name,
                    sub: performer.department,
                    value: performer.successful,
                    tip: `${performer.name} · ${performer.designation} · Rs. ${format(performer.revenue)} revenue · ${performer.conversionRate}% conversion`,
                  }))}
              />
            ) : (
              <div className="empty">No successful sales in this period yet.</div>
            )}

            <div style={{ overflowX: 'auto', marginTop: '1.25rem' }}>
              <table className="referral-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Code</th>
                    <th>Attempts</th>
                    <th>Successful</th>
                    <th>Conversion</th>
                    <th>Revenue</th>
                    <th>Incentive</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topPerformers.map((performer, index) => (
                    <tr key={performer.employeeId}>
                      <td>{index + 1}</td>
                      <td>{performer.name}</td>
                      <td>{performer.department}</td>
                      <td>{performer.designation}</td>
                      <td>{performer.couponCode}</td>
                      <td className="num">{performer.total}</td>
                      <td className="num">
                        <b>{performer.successful}</b>
                      </td>
                      <td className="num">{performer.conversionRate}%</td>
                      <td className="num">Rs. {format(performer.revenue)}</td>
                      <td className="num">Rs. {format(performer.incentive)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card fade-in-delay-1">
            <div className="card-title-row">
              <Building2 size={20} />
              <h2>Successful sales by department</h2>
            </div>
            {data.departments.some((department) => department.successful > 0) ? (
              <BarList
                rows={data.departments
                  .filter((department) => department.successful > 0)
                  .map((department) => ({
                    key: department.department,
                    label: department.department,
                    sub: `${department.activeReferrers} of ${department.referrers} referrers selling`,
                    value: department.successful,
                    tip: `${department.department} · Rs. ${format(department.revenue)} revenue · ${department.conversionRate}% conversion`,
                  }))}
              />
            ) : (
              <div className="empty">No department has a successful sale in this period yet.</div>
            )}

            <div style={{ overflowX: 'auto', marginTop: '1.25rem' }}>
              <table className="referral-table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Referrers</th>
                    <th>Actively selling</th>
                    <th>Attempts</th>
                    <th>Successful</th>
                    <th>Conversion</th>
                    <th>Revenue</th>
                    <th>Incentive</th>
                  </tr>
                </thead>
                <tbody>
                  {data.departments.map((department) => (
                    <tr key={department.department}>
                      <td>
                        <b>{department.department}</b>
                      </td>
                      <td className="num">{department.referrers}</td>
                      <td className="num">{department.activeReferrers}</td>
                      <td className="num">{department.total}</td>
                      <td className="num">
                        <b>{department.successful}</b>
                      </td>
                      <td className="num">{department.conversionRate}%</td>
                      <td className="num">Rs. {format(department.revenue)}</td>
                      <td className="num">Rs. {format(department.incentive)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card fade-in-delay-1">
            <div className="card-title-row">
              <TrendingUp size={20} />
              <h2>Successful sales per month</h2>
            </div>
            {data.monthly.length ? (
              <ColumnChart rows={data.monthly} />
            ) : (
              <div className="empty">Not enough history to plot a trend yet.</div>
            )}
          </div>

          <div className="card fade-in-delay-2">
            <div className="card-title-row">
              <Layers size={20} />
              <h2>Which plans referrals actually buy</h2>
            </div>
            {data.planMix.length ? (
              <BarList
                rows={data.planMix.slice(0, 8).map((plan) => ({
                  key: plan.planName,
                  label: plan.planName,
                  sub: `Rs. ${format(plan.revenue)} revenue`,
                  value: plan.successful,
                  tip: `${plan.planName} · ${plan.successful} sold · Rs. ${format(plan.revenue)}`,
                }))}
              />
            ) : (
              <div className="empty">No successful purchases in this period yet.</div>
            )}
          </div>
        </>
      ) : null}
    </main>
  )
}

/* -------------------------------------------------------------------- */

interface BarRow {
  key: string
  label: string
  sub?: string
  value: number
  tip: string
}

// Horizontal bars: one hue, magnitude read against a shared max. The value
// rides the bar's tip rather than needing an axis, and the same numbers are
// always repeated in the table beneath.
function BarList({ rows }: { rows: BarRow[] }) {
  const max = Math.max(...rows.map((row) => row.value), 1)
  return (
    <div className="bar-list">
      {rows.map((row) => (
        <div key={row.key} className="bar-row" title={row.tip}>
          <div className="bar-label">
            <span className="bar-label-main">{row.label}</span>
            {row.sub ? <span className="bar-label-sub">{row.sub}</span> : null}
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${Math.max((row.value / max) * 100, 1.5)}%` }} />
            <span className="bar-value">{row.value}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// Columns from a single baseline. Only the peak month is direct-labelled -
// a number on every column is noise; the rest are read off the y-axis ticks.
function ColumnChart({ rows }: { rows: Array<{ month: string; successful: number; revenue: number; total: number }> }) {
  const max = Math.max(...rows.map((row) => row.successful), 1)
  const ticks = axisTicks(max)
  const top = ticks[ticks.length - 1]

  return (
    <div className="column-chart">
      <div className="column-axis">
        {[...ticks].reverse().map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
      <div className="column-plot">
        {[...ticks].reverse().map((tick) => (
          <div key={tick} className="column-gridline" style={{ bottom: `${(tick / top) * 100}%` }} />
        ))}
        {rows.map((row) => (
          <div key={row.month} className="column-slot" title={`${monthLabel(row.month)} · ${row.successful} successful of ${row.total} attempts · Rs. ${format(row.revenue)}`}>
            <div className="column-bar-wrap">
              {row.successful === max && max > 0 ? <span className="column-value">{row.successful}</span> : null}
              <div className="column-bar" style={{ height: `${(row.successful / top) * 100}%` }} />
            </div>
            <span className="column-month">{monthLabel(row.month)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  hint,
  tint = '#eef1fb',
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  hint?: string
  tint?: string
}) {
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

function format(value: number): string {
  return new Intl.NumberFormat('en-IN').format(Math.round(value))
}

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-')
  const date = new Date(Number(year), Number(monthNumber) - 1, 1)
  return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

// Round ticks (0 / 5 / 10 …) rather than the raw max, so the axis reads cleanly.
function axisTicks(max: number): number[] {
  const step = max <= 4 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 60 ? 10 : max <= 150 ? 25 : 50
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let value = 0; value <= top; value += step) ticks.push(value)
  return ticks
}
