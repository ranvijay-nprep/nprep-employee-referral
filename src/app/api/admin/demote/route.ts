import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { countAdmins, demoteFromAdmin, getEmployeeById } from '@/lib/db'

// Removes someone's admin role. Their employee row, referral code and payout
// history are untouched - they simply drop back to the referrer view.
export async function POST(request: NextRequest) {
  const session = await requireAdmin()
  const body = (await request.json().catch(() => ({}))) as { employeeId?: number }
  const employeeId = Number(body.employeeId)

  if (!employeeId || !Number.isInteger(employeeId)) {
    return NextResponse.json({ error: 'Missing admin.' }, { status: 400 })
  }
  // Self-removal is blocked so an admin can't lock themselves out of the panel
  // they'd need in order to undo it.
  if (employeeId === session.employee.id) {
    return NextResponse.json({ error: 'You cannot remove your own admin access.' }, { status: 400 })
  }

  const target = getEmployeeById(employeeId)
  if (!target) return NextResponse.json({ error: 'Admin not found.' }, { status: 404 })
  if (target.role !== 'admin') return NextResponse.json({ error: 'That person is not an admin.' }, { status: 409 })
  if (countAdmins() <= 1) {
    return NextResponse.json({ error: 'There must always be at least one admin.' }, { status: 409 })
  }

  demoteFromAdmin(employeeId)
  return NextResponse.json({ ok: true, employeeId })
}
