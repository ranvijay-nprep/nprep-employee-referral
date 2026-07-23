import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { listMessageTemplates, updateMessageTemplate } from '@/lib/db'

// Max length of a single template. WhatsApp itself allows far more, but a
// wa.me URL carries the whole message in the query string and browsers start
// truncating very long URLs - keeping copy well under that avoids messages
// that silently arrive cut in half.
const MAX_BODY_LENGTH = 1200

export async function GET() {
  await requireAdmin()
  return NextResponse.json({ templates: listMessageTemplates() })
}

export async function PUT(request: NextRequest) {
  const session = await requireAdmin()
  const body = (await request.json().catch(() => ({}))) as { key?: string; body?: string }
  const key = String(body.key || '').trim()
  const text = String(body.body ?? '')

  if (!key) return NextResponse.json({ error: 'Missing template.' }, { status: 400 })
  if (text.length > MAX_BODY_LENGTH) {
    return NextResponse.json({ error: `Keep the message under ${MAX_BODY_LENGTH} characters.` }, { status: 400 })
  }

  const template = updateMessageTemplate(key, text, session.employee.id)
  if (!template) return NextResponse.json({ error: 'Unknown template.' }, { status: 404 })
  return NextResponse.json({ template })
}
