import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkCouponActivations } from '@/lib/couponActivation'

// Manual/debug trigger - the real schedule runs in-process via node-cron
// (see src/instrumentation.ts), since this app now runs as a long-lived
// server on Railway rather than Vercel's per-request serverless functions.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await checkCouponActivations()
  return NextResponse.json(result)
}
