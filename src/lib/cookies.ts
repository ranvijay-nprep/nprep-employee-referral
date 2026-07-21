export const SESSION_COOKIE = 'nprep_employee_session'
export const STATE_COOKIE = 'nprep_oauth_state'

export function sessionCookieOptions(expiresAt: string) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(expiresAt),
    path: '/',
  }
}
