// The app's own externally-reachable base URL (no trailing slash), e.g.
// "http://localhost:3000" locally or "https://web-production-xxxx.up.railway.app"
// in production. Deriving this from the incoming request's URL/Host header is
// NOT reliable here - this app runs behind a custom server (server.ts) fronted
// by Railway's proxy, and Next.js's request.url silently falls back to an
// internal "http://localhost:3000" placeholder in that setup rather than the
// real public host. An explicit env var sidesteps that entirely.
export function getAppUrl(): string {
  const url = process.env.APP_URL
  if (!url) throw new Error('APP_URL is not configured')
  return url.replace(/\/$/, '')
}
