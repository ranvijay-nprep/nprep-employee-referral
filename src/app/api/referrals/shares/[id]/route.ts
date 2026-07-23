import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth'
import { deleteShare, markShareReminded } from '@/lib/db'

// Both handlers scope the write to the signed-in employee (see db.ts), so an
// id belonging to someone else's tracker simply doesn't match.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession()
  const id = Number((await params).id)
  if (!id || !Number.isInteger(id)) return NextResponse.json({ error: 'Bad request.' }, { status: 400 })

  if (!deleteShare(id, session.userId)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}

// Records that a reminder was sent, so the tracker can show "last nudged" and
// the employee doesn't pester the same person twice in a day.
export async function PATCH(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession()
  const id = Number((await params).id)
  if (!id || !Number.isInteger(id)) return NextResponse.json({ error: 'Bad request.' }, { status: 400 })

  markShareReminded(id, session.userId)
  return NextResponse.json({ ok: true })
}
