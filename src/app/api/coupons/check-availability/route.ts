import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth'
import { getCouponRequestByCode } from '@/lib/db'
import { nprepCouponExists } from '@/lib/nprepDb'
import { isValidCode, normalizeCode, suggestAlternates } from '@/lib/couponCode'

export async function GET(request: NextRequest) {
  await requireSession()

  const raw = new URL(request.url).searchParams.get('code') || ''
  const code = normalizeCode(raw)
  if (!isValidCode(code)) {
    return NextResponse.json({ available: false, code, reason: 'Code must be 3-12 letters/numbers.', suggestions: [] })
  }

  const taken = await isCodeTaken(code)
  if (!taken) return NextResponse.json({ available: true, code, suggestions: [] })

  const suggestions = await pickAvailableSuggestions(code)
  return NextResponse.json({ available: false, code, reason: 'That code is already taken.', suggestions })
}

async function isCodeTaken(code: string): Promise<boolean> {
  const existsLocally = Boolean(getCouponRequestByCode(code))
  if (existsLocally) return true
  return nprepCouponExists(code)
}

async function pickAvailableSuggestions(base: string): Promise<string[]> {
  const candidates = suggestAlternates(base, 6)
  const available: string[] = []
  for (const candidate of candidates) {
    if (available.length >= 3) break
    if (!(await isCodeTaken(candidate))) available.push(candidate)
  }
  return available
}
