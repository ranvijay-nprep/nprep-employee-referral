import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getEmployeeWithProfile, promoteToAdmin } from '@/lib/db'
import { isAllowedEmail } from '@/lib/domain'

export async function POST(request: NextRequest) {
  await requireAdmin()
  const body = (await request.json().catch(() => ({}))) as { email?: string }
  const email = String(body.email || '').trim().toLowerCase()

  if (!email || !isAllowedEmail(email)) {
    return NextResponse.json({ error: 'Enter a valid @nprep.in email address.' }, { status: 400 })
  }

  const employee = promoteToAdmin(email)
  // Return the directory-joined row so the admin table can show the new
  // admin's real name, department and designation without a page reload.
  return NextResponse.json({ employee: getEmployeeWithProfile(employee.id) ?? employee })
}
