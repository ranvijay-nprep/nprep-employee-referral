import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { exchangeCodeForIdentity } from '@/lib/googleAuth'
import { isAllowedEmail, isBootstrapAdmin } from '@/lib/domain'
import { createSession, findOrCreateEmployee } from '@/lib/db'
import { ensureReferralForLogin } from '@/lib/autoAssign'
import { getAppUrl } from '@/lib/appUrl'
import { SESSION_COOKIE, STATE_COOKIE, sessionCookieOptions } from '@/lib/cookies'

// Google redirects here after the user picks an account. This is the ONLY
// place that creates an `employees` row - everywhere else treats "no
// employees row" as "not signed in".
export async function GET(request: NextRequest) {
  const origin = getAppUrl()
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const expectedState = request.cookies.get(STATE_COOKIE)?.value

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  let identity
  try {
    identity = await exchangeCodeForIdentity(`${origin}/auth/callback`, code)
  } catch (error) {
    console.error('Google token exchange failed', error)
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  if (!identity.emailVerified) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  // The Google "hd" param on the authorize URL only narrows the account
  // picker's UI - this is the real, server-side enforcement of "company
  // accounts only".
  if (!isAllowedEmail(identity.email)) {
    return NextResponse.redirect(`${origin}/login?error=domain`)
  }

  const employee = findOrCreateEmployee(identity.email, identity.name, isBootstrapAdmin(identity.email) ? 'admin' : 'employee')
  // Automatic-on-login: match this email to the directory and create their
  // NPrep<EmployeeNo> code if we can. Best-effort - never blocks sign-in.
  await ensureReferralForLogin(employee)
  const session = createSession(employee.id)

  // Admins land on the admin dashboard by default; they can switch to their
  // own referrer view from there. Everyone else goes straight to the referrer
  // dashboard.
  const destination = employee.role === 'admin' ? '/admin' : '/'
  const response = NextResponse.redirect(`${origin}${destination}`)
  response.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt))
  response.cookies.delete(STATE_COOKIE)
  return response
}
