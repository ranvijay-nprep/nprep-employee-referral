import { OAuth2Client } from 'google-auth-library'

// Rolled-by-hand Google OAuth2 (authorization-code flow) - deliberately not a
// framework like Auth.js/NextAuth. This app's DB layer (src/lib/db.ts) already
// follows navigator-ts's pattern of a hand-rolled session-cookie table
// (crypto random token, sha256-hashed, looked up per request); this mirrors
// that same pattern, just with Google establishing identity instead of an
// OTP. Keeping one consistent auth style across NPrep's internal tools.
export function getOAuthClient(redirectUri: string): OAuth2Client {
  return new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri,
  })
}

export function buildAuthUrl(redirectUri: string, state: string, hostedDomainHint: string): string {
  const client = getOAuthClient(redirectUri)
  return client.generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    state,
    // UX hint only, narrows Google's account picker - NOT a security boundary.
    // The real domain check happens server-side after the token comes back.
    hd: hostedDomainHint || undefined,
  })
}

export interface GoogleIdentity {
  email: string
  emailVerified: boolean
  name: string
}

// Exchanges the authorization `code` for tokens, then verifies the ID token's
// signature/audience/issuer (not just decoding it) before trusting its claims.
export async function exchangeCodeForIdentity(redirectUri: string, code: string): Promise<GoogleIdentity> {
  const client = getOAuthClient(redirectUri)
  const { tokens } = await client.getToken(code)
  if (!tokens.id_token) throw new Error('Google did not return an ID token')

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID,
  })
  const payload = ticket.getPayload()
  if (!payload?.email) throw new Error('Google token did not include an email')

  return {
    email: payload.email,
    emailVerified: Boolean(payload.email_verified),
    name: payload.name || payload.email.split('@')[0],
  }
}
