import { BarChart3, ShieldCheck, Ticket } from 'lucide-react'

// Admin-only segmented control to move between the Admin dashboard (/admin),
// the Analytics dashboard (/admin/analytics) and the personal Referrer
// dashboard (/). The current view renders as a non-clickable label; the others
// as links. Only render this for admins - regular employees have no admin view
// to switch to.
const OPTIONS = [
  { key: 'admin', label: 'Admin', href: '/admin', Icon: ShieldCheck },
  { key: 'analytics', label: 'Analytics', href: '/admin/analytics', Icon: BarChart3 },
  { key: 'referrer', label: 'Referrer', href: '/', Icon: Ticket },
] as const

export type ViewSwitchKey = (typeof OPTIONS)[number]['key']

export default function ViewSwitch({ current }: { current: ViewSwitchKey }) {
  return (
    <div className="view-switch" role="group" aria-label="Switch dashboard view">
      {OPTIONS.map(({ key, label, href, Icon }) =>
        key === current ? (
          <span key={key} className="view-switch-opt active" aria-current="page">
            <Icon size={15} /> {label}
          </span>
        ) : (
          <a key={key} href={href} className="view-switch-opt">
            <Icon size={15} /> {label}
          </a>
        ),
      )}
    </div>
  )
}
