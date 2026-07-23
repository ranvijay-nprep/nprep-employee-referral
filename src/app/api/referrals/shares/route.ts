import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth'
import { getCouponRequestByEmployeeId, recordShare } from '@/lib/db'
import { getShareTracker } from '@/lib/shares'
import { isValidPhone, normalizePhone } from '@/lib/phone'

const MAX_NAME_LENGTH = 80
const MAX_NOTE_LENGTH = 280

// Every route here is scoped to the signed-in employee's own shares - an
// employee's referee list is theirs alone, and nothing accepts an employeeId
// from the request body.
export async function GET() {
  const session = await requireSession()
  const coupon = getCouponRequestByEmployeeId(session.userId)
  const tracker = await getShareTracker(session.userId, coupon?.status === 'active' ? coupon.code : null)
  return NextResponse.json(tracker)
}

export async function POST(request: NextRequest) {
  const session = await requireSession()
  const body = (await request.json().catch(() => ({}))) as {
    name?: string
    phone?: string
    note?: string
    channel?: string
  }

  const name = String(body.name || '').trim().slice(0, MAX_NAME_LENGTH)
  const phone = String(body.phone || '').trim()
  const note = String(body.note || '').trim().slice(0, MAX_NOTE_LENGTH)
  const channel = body.channel === 'other' ? 'other' : 'whatsapp'

  if (!name) return NextResponse.json({ error: "Add the person's name." }, { status: 400 })
  if (!isValidPhone(phone)) {
    return NextResponse.json({ error: 'Enter a valid 10-digit mobile number.' }, { status: 400 })
  }

  const coupon = getCouponRequestByEmployeeId(session.userId)
  if (!coupon) {
    return NextResponse.json({ error: "You don't have a referral code yet." }, { status: 409 })
  }

  const share = recordShare({
    employeeId: session.userId,
    couponCode: coupon.code,
    refereeName: name,
    refereePhone: normalizePhone(phone),
    channel,
    note: note || null,
  })

  return NextResponse.json({ share })
}
