import { ShieldCheck, Ticket } from 'lucide-react'

// Shown on the REFERRER dashboard only, so an admin can get back to the admin
// area. Inside /admin the sidebar handles navigation, so this isn't rendered
// there - which is why there's no "analytics" option: that lives in the
// sidebar now.
const OPTIONS = [
  { key: 'admin', label: 'Admin', href: '/admin', Icon: ShieldCheck },
  { key: 'referrer', label: 'Referrer', href: '/', Icon: Ticket },
] as const

export default function ViewSwitch({ current }: { current: 'admin' | 'referrer' }) {
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
