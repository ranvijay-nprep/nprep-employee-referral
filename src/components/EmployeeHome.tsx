'use client'

import { useState } from 'react'
import { Building2, Check, Copy, IdCard, Info, Megaphone, Share2, XCircle } from 'lucide-react'
import CouponStepper from '@/components/CouponStepper'
import ReportView from '@/components/ReportView'
import LogoutButton from '@/components/LogoutButton'
import IncentiveRateCard from '@/components/IncentiveRateCard'
import ShareTracker from '@/components/ShareTracker'
import ViewSwitch from '@/components/ViewSwitch'
import WhatsAppButton from '@/components/WhatsAppButton'
import { buildEmployeeCouponCode } from '@/lib/couponCode'
import { STUDENT_APP_URL, getDefaultTemplateBody, renderTemplate } from '@/lib/messages'
import { STUDENT_DISCOUNT_PERCENT } from '@/lib/incentives'
import type { CouponRequest, Employee } from '@/lib/types'

// Who employees are told to ask when their account isn't in the directory.
// Change here if a different admin owns onboarding.
const CODE_APPROVER = 'Utkarsh sir'

export default function EmployeeHome({
  employee,
  coupon,
  directoryCode,
  department,
  designation,
  templates,
}: {
  employee: Employee
  coupon: CouponRequest | null
  directoryCode: string | null
  department: string | null
  designation: string | null
  // Admin-managed copy, keyed by template name - see src/lib/messages.ts.
  templates: Record<string, string>
}) {
  const current = coupon
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const firstName = employee.name.split(' ')[0]
  const template = (key: string) => templates[key] ?? getDefaultTemplateBody(key)
  const notice = (templates.employee_notice ?? '').trim()

  // The generic (not-to-a-specific-person) fill: no referee name is known, so
  // {{name}} becomes a neutral greeting.
  const fill = (body: string, code: string) =>
    renderTemplate(body, {
      name: 'there',
      code,
      discount: String(STUDENT_DISCOUNT_PERCENT),
      referrer: firstName,
      link: STUDENT_APP_URL,
    })

  const copyShareMessage = async (code: string) => {
    const text = fill(template('copy_share'), code)
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for browsers/contexts (e.g. non-HTTPS, older browsers)
        // where the async Clipboard API isn't available at all.
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopyState('copied')
    } catch (error) {
      console.error('Failed to copy share message', error)
      setCopyState('failed')
    } finally {
      setTimeout(() => setCopyState('idle'), 2000)
    }
  }

  return (
    <main className="page">
      <div className="page-header fade-in">
        <div>
          <h1>Hi, {firstName} 👋</h1>
          {department || designation ? (
            <div className="profile-chips">
              {department ? (
                <span className="profile-chip">
                  <Building2 size={13} /> {department}
                </span>
              ) : null}
              {designation ? (
                <span className="profile-chip">
                  <IdCard size={13} /> {designation}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="header-actions">
          {employee.role === 'admin' ? <ViewSwitch current="referrer" /> : null}
          <LogoutButton />
        </div>
      </div>

      {notice ? (
        <div className="notice-banner fade-in">
          <Megaphone size={18} />
          <span>{notice}</span>
        </div>
      ) : null}

      <IncentiveRateCard />

      {!current ? (
        <div className="card fade-in">
          <div className="card-title-row">
            <Info size={20} />
            <h2>Your referral code isn&apos;t ready yet</h2>
          </div>
          {directoryCode ? (
            <p>
              Your referral code <b>{buildEmployeeCouponCode(directoryCode)}</b> is being set up and will appear here
              shortly. If it doesn&apos;t, reach out to <b>{CODE_APPROVER}</b>.
            </p>
          ) : (
            <p>
              We couldn&apos;t find your account in the employee directory, so your referral code can&apos;t be generated
              automatically. Please ask <b>{CODE_APPROVER}</b> to add you.
            </p>
          )}
        </div>
      ) : null}

      {current && current.status === 'pending' ? (
        <div className="card fade-in">
          <div className="card-title-row">
            <h2>Your code: {current.code}</h2>
          </div>
          <p>
            This was assigned to you automatically from your employee record — nothing for you to do. It&apos;s just
            being switched on in NPrep, and you&apos;ll get an email the moment it&apos;s live.
          </p>
          <CouponStepper status={current.status} />
        </div>
      ) : null}

      {current && current.status === 'active' ? (
        <>
          <div className="card fade-in">
            <div className="card-title-row">
              <Share2 size={20} />
              <h2>Share your code</h2>
            </div>
            <p>Send this to anyone who wants to buy an NPrep plan - they get {STUDENT_DISCOUNT_PERCENT}% off:</p>
            <div className="share-code">{current.code}</div>
            <div className="share-actions">
              {/* No phone number: opens WhatsApp's own contact picker, for
                  sharing to a group or someone not in the tracker below. */}
              <WhatsAppButton text={fill(template('whatsapp_share'), current.code)} label="Share on WhatsApp" />
              <button className="secondary" onClick={() => copyShareMessage(current.code)}>
                {copyState === 'copied' ? (
                  <>
                    <Check size={16} /> Copied!
                  </>
                ) : copyState === 'failed' ? (
                  <>
                    <XCircle size={16} /> Could not copy - try manually
                  </>
                ) : (
                  <>
                    <Copy size={16} /> Copy share message
                  </>
                )}
              </button>
            </div>
          </div>

          <ShareTracker
            couponCode={current.code}
            referrerName={firstName}
            shareTemplate={template('whatsapp_share')}
            reminderTemplate={template('whatsapp_reminder')}
          />

          <div className="fade-in-delay-1">
            <ReportView isAdmin={false} personal />
          </div>
        </>
      ) : null}

      {current && current.status === 'rejected' ? (
        <div className="card fade-in">
          <p>Your code request wasn&apos;t approved. Please reach out to the admin team.</p>
        </div>
      ) : null}
    </main>
  )
}
