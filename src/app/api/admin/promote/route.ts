import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { promoteToAdmin } from '@/lib/db'
import { isAllowedEmail } from '@/lib/domain'

export async function POST(request: NextRequest) {
  await requireAdmin()
  const body = (await request.json().catch(() => ({}))) as { email?: string }
  const email = String(body.email || '').trim().toLowerCase()

  if (!email || !isAllowedEmail(email)) {
    return NextResponse.json({ error: 'Enter a valid @nprep.in email address.' }, { status: 400 })
  }

  const employee = promoteToAdmin(email)
  return NextResponse.json({ employee })
}
