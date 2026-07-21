import { Resend } from 'resend'
import type { CouponRequest } from '@/lib/types'

let resend: Resend | undefined

function getResend(): Resend {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY)
  return resend
}

// Sent once, right after an employee submits a code request. Contains every
// field an admin needs to manually create the coupon in NPrep's own system.
// `recipients` should be every current admin's email (see listAdmins in
// db.ts) - fetched fresh at send-time so a newly-added admin is included
// automatically, with no env var to keep in sync by hand.
export async function sendAdminCouponRequestEmail(request: CouponRequest, employeeEmail: string, recipients: string[]): Promise<void> {
  if (!recipients.length) throw new Error('No admin recipients to notify')

  await getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: recipients,
    subject: `New referral coupon to create: ${request.code}`,
    html: `
      <p>An employee has requested a new referral coupon. Please create it in NPrep with these exact details:</p>
      <table cellpadding="6" style="border-collapse:collapse">
        <tr><td><b>Coupon code</b></td><td>${escapeHtml(request.code)}</td></tr>
        <tr><td><b>Employee email</b></td><td>${escapeHtml(employeeEmail)}</td></tr>
        <tr><td><b>Activation date</b></td><td>${request.activation_date}</td></tr>
        <tr><td><b>Expiry date</b></td><td>${request.expiry_date}</td></tr>
        <tr><td><b>Usage limit</b></td><td>${request.usage_limit}</td></tr>
      </table>
      <p>Once it's live in NPrep, this system will detect it automatically and notify the employee - no further action needed here.</p>
    `,
  })
}

// Sent once, automatically, when the cron job detects the coupon now exists
// in NPrep's coupons table.
export async function sendEmployeeCouponActiveEmail(employeeEmail: string, code: string): Promise<void> {
  await getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: employeeEmail,
    subject: 'Your referral code is live!',
    html: `
      <p>Your referral code <b>${escapeHtml(code)}</b> is now active on NPrep.</p>
      <p>You can start sharing it now - anyone who uses it at checkout will be attributed to you.</p>
    `,
  })
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}
