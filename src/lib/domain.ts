// Server-side check restricting sign-in to the company's Google Workspace
// domain. The Google OAuth "hd" param (passed when starting the sign-in flow)
// only narrows the account picker's UI - it is not a security boundary, so
// every server-side code path that trusts a session MUST also call this.
export function isAllowedEmail(email: string | null | undefined): boolean {
  const domain = (process.env.ALLOWED_EMAIL_DOMAIN || '').trim().toLowerCase()
  if (!domain) throw new Error('ALLOWED_EMAIL_DOMAIN is not configured')
  return String(email || '').trim().toLowerCase().endsWith(`@${domain}`)
}

export function isBootstrapAdmin(email: string): boolean {
  const admins = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
  return admins.includes(email.trim().toLowerCase())
}
