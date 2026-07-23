import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getAnalytics } from '@/lib/analytics'

export async function GET(request: NextRequest) {
  await requireAdmin()
  const params = new URL(request.url).searchParams
  try {
    const analytics = await getAnalytics({ fromDate: params.get('fromDate'), toDate: params.get('toDate') })
    return NextResponse.json(analytics)
  } catch (error) {
    console.error('Analytics failed', error)
    return NextResponse.json({ error: "Couldn't read purchase data from NPrep." }, { status: 502 })
  }
}
