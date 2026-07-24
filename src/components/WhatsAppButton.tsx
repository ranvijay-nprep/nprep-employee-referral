'use client'

import type { ReactNode } from 'react'
import { MessageCircle } from 'lucide-react'
import { toWhatsAppNumber } from '@/lib/phone'

// Opens WhatsApp with the message already typed in. Rendered as a real <a>
// rather than a button that calls window.open: the tab has to be opened by the
// browser's own handling of the click, otherwise (once any await has run) it
// is treated as a popup and blocked.
//
// `onSend` therefore fires alongside the navigation and must not be awaited -
// it records the share, it doesn't gate it.
export default function WhatsAppButton({
  phone,
  text,
  onSend,
  label,
  icon,
  variant = 'primary',
  disabled,
}: {
  // Omit to open WhatsApp's contact picker instead of a specific chat.
  phone?: string
  text: string
  onSend?: () => void
  label: string
  icon?: ReactNode
  variant?: 'primary' | 'secondary'
  disabled?: boolean
}) {
  const number = phone ? toWhatsAppNumber(phone) : ''
  const href = `https://wa.me/${number}?text=${encodeURIComponent(text)}`

  // Same WhatsApp green when disabled, just dimmed. Falling back to a plain
  // `button.primary` here made it turn blue, so the control looked like a
  // different button entirely rather than the same one waiting for input.
  if (disabled) {
    return (
      <span className={`button-link ${variant} is-disabled`} aria-disabled="true">
        {icon ?? <MessageCircle size={16} />} {label}
      </span>
    )
  }

  return (
    <a
      className={`button-link ${variant}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onSend?.()}
    >
      {icon ?? <MessageCircle size={16} />} {label}
    </a>
  )
}
