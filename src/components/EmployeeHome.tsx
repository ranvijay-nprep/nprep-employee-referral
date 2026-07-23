'use client'

import { useState } from 'react'
import { Check, Copy, Info, Share2, XCircle } from 'lucide-react'
import CouponStepper from '@/components/CouponStepper'
import ReportView from '@/components/ReportView'
import LogoutButton from '@/components/LogoutButton'
import IncentiveRateCard from '@/components/IncentiveRateCard'
import ViewSwitch from '@/components/ViewSwitch'
import { buildEmployeeCouponCode } from '@/lib/couponCode'
import { STUDENT_DISCOUNT_PERCENT } from '@/lib/incentives'
import type { CouponRequest, Employee } from '@/lib/types'

// Who employees are told to ask when their account isn't in the directory.
// Change here if a different admin owns onboarding.
const CODE_APPROVER = 'Utkarsh sir'

export default function EmployeeHome({
  employee,
  coupon,
  directoryCode,
}: {
  employee: Employee
  coupon: CouponRequest | null
  directoryCode: string | null
}) {
  const current = coupon
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const copyShareMessage = async (code: string) => {
    const text = `Use my NPrep referral code ${code} to get ${STUDENT_DISCOUNT_PERCENT}% off any NPrep plan!`
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
        <h1>Hi, {employee.name.split(' ')[0]} 👋</h1>
        <div className="header-actions">
          {employee.role === 'admin' ? <ViewSwitch current="referrer" /> : null}
          <LogoutButton />
        </div>
      </div>

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
            We&apos;ve notified the admin team to activate it in NPrep. You&apos;ll get an email the moment it&apos;s live -
            usually within a few hours.
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
            <p style={{ marginTop: '0.75rem' }}>
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
            </p>
          </div>
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
