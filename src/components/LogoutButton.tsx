'use client'

import { LogOut } from 'lucide-react'

export default function LogoutButton() {
  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }
  return (
    <button className="secondary" onClick={logout} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
      <LogOut size={16} />
      Sign out
    </button>
  )
}
