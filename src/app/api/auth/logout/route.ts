import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { deleteSession } from '@/lib/db'
import { SESSION_COOKIE } from '@/lib/cookies'

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value || ''
  deleteSession(token)
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(SESSION_COOKIE)
  return response
}
