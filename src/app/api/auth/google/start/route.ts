import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { buildAuthUrl } from '@/lib/googleAuth'
import { STATE_COOKIE } from '@/lib/cookies'

export function GET(request: NextRequest) {
  const { origin } = new URL(request.url)
  const redirectUri = `${origin}/auth/callback`
  const state = crypto.randomBytes(16).toString('base64url')
  const hostedDomainHint = process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN || ''

  const response = NextResponse.redirect(buildAuthUrl(redirectUri, state, hostedDomainHint))
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60,
    path: '/',
  })
  return response
}
