'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { BarChart3, Inbox, LayoutDashboard, MessageSquareText, ShieldCheck, Ticket } from 'lucide-react'
import LogoutButton from '@/components/LogoutButton'

// The admin area used to be one 3,700px scroll: overview, the coupon queue,
// the admin roster, four message-template editors and the full payout report,
// all stacked. The day-to-day work (the queue and the report) sat below a wall
// of settings that change maybe once a month.
//
// So the sections are real routes behind a sidebar. Everything an admin
// touches daily is one click away, and the rarely-touched settings live at the
// bottom of the nav under their own heading instead of in the way.
const SECTIONS = [
  {
    heading: null,
    items: [
      { href: '/admin', label: 'Overview', Icon: LayoutDashboard, badge: 'attention' as const },
      { href: '/admin/referrals', label: 'Referrals & payouts', Icon: Ticket, badge: null },
      { href: '/admin/analytics', label: 'Analytics', Icon: BarChart3, badge: null },
    ],
  },
  {
    heading: 'Settings',
    items: [
      { href: '/admin/team', label: 'Admins', Icon: ShieldCheck, badge: null },
      { href: '/admin/messages', label: 'Messages', Icon: MessageSquareText, badge: null },
    ],
  },
]

export interface AdminBadges {
  needsAttention: number
  pending: number
}

export default function AdminShell({
  adminName,
  badges,
  children,
}: {
  adminName: string
  badges: AdminBadges
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark">N</span>
          <span className="admin-brand-text">
            NPrep Referrals
            <small>Admin</small>
          </span>
        </div>

        <nav className="admin-nav" aria-label="Admin sections">
          {SECTIONS.map((section) => (
            <div key={section.heading ?? 'main'} className="admin-nav-group">
              {section.heading ? <p className="admin-nav-heading">{section.heading}</p> : null}
              {section.items.map(({ href, label, Icon, badge }) => {
                // `/admin` would otherwise match every child route.
                const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
                const count = badge === 'attention' ? badges.needsAttention + badges.pending : 0
                return (
                  <Link key={href} href={href} className={`admin-nav-item${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
                    <Icon size={17} />
                    <span>{label}</span>
                    {count ? <span className="admin-nav-badge">{count}</span> : null}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <Link href="/" className="admin-nav-item">
            <Inbox size={17} />
            <span>My referrer view</span>
          </Link>
          <div className="admin-user">
            <span className="admin-user-name" title={adminName}>
              {adminName}
            </span>
            <LogoutButton />
          </div>
        </div>
      </aside>

      <div className="admin-main">{children}</div>
    </div>
  )
}
