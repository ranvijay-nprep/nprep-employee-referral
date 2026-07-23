'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  BellRing,
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  Trash2,
  UserPlus,
  XCircle,
} from 'lucide-react'
import WhatsAppButton from '@/components/WhatsAppButton'
import { STUDENT_APP_URL, renderTemplate } from '@/lib/messages'
import { STUDENT_DISCOUNT_PERCENT } from '@/lib/incentives'
import { formatPhone, isValidPhone } from '@/lib/phone'
import type { ReferralShareRow, ShareStatus } from '@/lib/types'

interface TrackerResponse {
  rows: ReferralShareRow[]
  purchaseCheckAvailable: boolean
}

const STATUS_LABEL: Record<ShareStatus, string> = {
  purchased: 'Purchased 🎉',
  in_progress: 'Checkout started',
  failed: 'Payment failed',
  waiting: 'Not purchased yet',
}

const STATUS_TONE: Record<ShareStatus, string> = {
  purchased: 'success',
  in_progress: 'pending',
  failed: 'failed',
  waiting: 'pending',
}

// Who an employee sent their coupon to, and whether those people actually
// bought. A coupon is a broadcast code, so this list is the ONLY way the
// employee (or the admin analytics) can tell a share apart from a conversion -
// the status column is matched live against NPrep purchases by phone number.
export default function ShareTracker({
  couponCode,
  referrerName,
  shareTemplate,
  reminderTemplate,
}: {
  couponCode: string
  referrerName: string
  shareTemplate: string
  reminderTemplate: string
}) {
  const [rows, setRows] = useState<ReferralShareRow[]>([])
  const [checkAvailable, setCheckAvailable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/referrals/shares')
      if (!response.ok) throw new Error(await response.text())
      const data = (await response.json()) as TrackerResponse
      setRows(data.rows)
      setCheckAvailable(data.purchaseCheckAvailable)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your referral tracker')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const message = (template: string, refereeName: string) =>
    renderTemplate(template, {
      name: refereeName,
      code: couponCode,
      discount: String(STUDENT_DISCOUNT_PERCENT),
      referrer: referrerName,
      link: STUDENT_APP_URL,
    })

  // Fired from the WhatsApp link's onClick. Deliberately NOT awaited before
  // the browser follows the link - awaiting first would turn the WhatsApp tab
  // into a popup, which browsers block.
  const saveShare = (refereeName: string, refereePhone: string) => {
    void (async () => {
      try {
        const response = await fetch('/api/referrals/shares', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: refereeName, phone: refereePhone, channel: 'whatsapp' }),
        })
        const data = (await response.json()) as { error?: string }
        if (!response.ok) throw new Error(data.error || 'Could not save')
        setName('')
        setPhone('')
        await load()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save this share')
      }
    })()
  }

  const markReminded = (id: number) => {
    void fetch(`/api/referrals/shares/${id}`, { method: 'PATCH' }).then(load).catch(() => {})
  }

  const remove = async (row: ReferralShareRow) => {
    if (!window.confirm(`Remove ${row.referee_name} from your tracker?`)) return
    setBusyId(row.id)
    try {
      const response = await fetch(`/api/referrals/shares/${row.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(await response.text())
      setRows((prev) => prev.filter((item) => item.id !== row.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove')
    } finally {
      setBusyId(null)
    }
  }

  const canSend = Boolean(name.trim()) && isValidPhone(phone)
  const purchased = rows.filter((row) => row.status === 'purchased').length
  const waiting = rows.filter((row) => row.status !== 'purchased').length

  return (
    <div className="card fade-in-delay-1">
      <div className="card-title-row">
        <UserPlus size={20} />
        <h2>People you&apos;ve shared with ({rows.length})</h2>
      </div>
      <p>
        Send your coupon straight to someone on WhatsApp and it gets tracked here — so you can see who has actually
        bought and who still needs a nudge.
      </p>

      {error ? (
        <div className="error-banner">
          <AlertCircle size={16} /> {error}
        </div>
      ) : null}

      {!checkAvailable ? (
        <div className="error-banner">
          <AlertCircle size={16} /> Purchase status couldn&apos;t be checked just now — the list below may be out of date.
        </div>
      ) : null}

      <div className="share-form">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Student's name"
          aria-label="Student's name"
        />
        <input
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="10-digit mobile number"
          aria-label="Student's mobile number"
        />
        <WhatsAppButton
          phone={phone}
          text={message(shareTemplate, name.trim() || 'there')}
          disabled={!canSend}
          onSend={() => saveShare(name.trim(), phone)}
          label="Send on WhatsApp"
        />
      </div>
      {phone && !isValidPhone(phone) ? (
        <p className="availability-msg bad">Enter a valid 10-digit mobile number.</p>
      ) : null}

      {rows.length ? (
        <div className="share-summary">
          <span className="status-chip success">
            <CheckCircle2 size={12} /> {purchased} purchased
          </span>
          <span className="status-chip pending">
            <Clock size={12} /> {waiting} yet to buy
          </span>
          <span className="muted-cell">
            {rows.length ? `${Math.round((purchased / rows.length) * 100)}% conversion` : null}
          </span>
        </div>
      ) : null}

      {loading ? (
        <div className="empty">
          <Loader2 size={28} /> Loading your tracker…
        </div>
      ) : rows.length ? (
        <div style={{ overflowX: 'auto' }}>
          <table className="referral-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Shared</th>
                <th>Status</th>
                <th>Plan bought</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.referee_name}
                    <br />
                    <small>{formatPhone(row.referee_phone)}</small>
                  </td>
                  <td>
                    {row.daysSinceShared === 0 ? 'Today' : `${row.daysSinceShared}d ago`}
                    {row.last_reminded_at ? (
                      <>
                        <br />
                        <small>nudged {new Date(row.last_reminded_at).toLocaleDateString()}</small>
                      </>
                    ) : null}
                  </td>
                  <td>
                    <span className={`status-chip ${STATUS_TONE[row.status]}`}>
                      {row.status === 'purchased' ? (
                        <CheckCircle2 size={12} />
                      ) : row.status === 'failed' ? (
                        <XCircle size={12} />
                      ) : (
                        <Clock size={12} />
                      )}
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>
                  <td>
                    {row.status === 'purchased' ? (
                      <>
                        {row.planName}
                        <br />
                        <small>You earned Rs. {row.incentiveAmount}</small>
                      </>
                    ) : (
                      <span className="muted-cell">—</span>
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      {row.status !== 'purchased' ? (
                        <WhatsAppButton
                          phone={row.referee_phone}
                          text={message(reminderTemplate, row.referee_name)}
                          onSend={() => markReminded(row.id)}
                          label="Remind"
                          icon={<BellRing size={16} />}
                          variant="secondary"
                        />
                      ) : null}
                      <button
                        className="icon-button"
                        onClick={() => remove(row)}
                        disabled={busyId === row.id}
                        aria-label={`Remove ${row.referee_name}`}
                        title="Remove from tracker"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          <Inbox size={32} />
          No one tracked yet — send your coupon to someone above to get started.
        </div>
      )}
    </div>
  )
}
