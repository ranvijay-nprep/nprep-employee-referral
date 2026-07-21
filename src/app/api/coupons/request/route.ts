import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth'
import { createCouponRequest, getCouponRequestByCode, getCouponRequestByEmployeeId, listAdmins, markCouponAdminNotified } from '@/lib/db'
import { nprepCouponExists } from '@/lib/nprepDb'
import { isValidCode, normalizeCode } from '@/lib/couponCode'
import { sendAdminCouponRequestEmail } from '@/lib/email'

const USAGE_LIMIT = 100
const EXPIRY_MONTHS = 6

export async function POST(request: NextRequest) {
  const session = await requireSession()
  const body = (await request.json().catch(() => ({}))) as { code?: string }
  const code = normalizeCode(String(body.code || ''))

  if (!isValidCode(code)) {
    return NextResponse.json({ error: 'Code must be 3-12 letters/numbers.' }, { status: 400 })
  }

  if (getCouponRequestByEmployeeId(session.userId)) {
    return NextResponse.json({ error: 'You already have a referral code.' }, { status: 400 })
  }

  if (getCouponRequestByCode(code) || (await nprepCouponExists(code))) {
    return NextResponse.json({ error: 'That code is already taken.' }, { status: 409 })
  }

  const activationDate = new Date()
  const expiryDate = new Date(activationDate)
  expiryDate.setMonth(expiryDate.getMonth() + EXPIRY_MONTHS)

  let created
  try {
    created = createCouponRequest({
      employeeId: session.userId,
      code,
      usageLimit: USAGE_LIMIT,
      activationDate: isoDate(activationDate),
      expiryDate: isoDate(expiryDate),
    })
  } catch {
    // Unique constraint race: someone else grabbed this code between our
    // check above and the insert.
    return NextResponse.json({ error: 'That code was just taken - please try another.' }, { status: 409 })
  }

  try {
    const adminEmails = listAdmins().map((admin) => admin.email)
    await sendAdminCouponRequestEmail(created, session.email, adminEmails)
    markCouponAdminNotified(created.id)
  } catch (emailError) {
    // The request itself succeeded and is visible on the admin fallback
    // dashboard either way - failing to send the email shouldn't fail the
    // employee-facing request.
    console.error('Failed to send admin coupon-request email', emailError)
  }

  return NextResponse.json({ request: created })
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}
