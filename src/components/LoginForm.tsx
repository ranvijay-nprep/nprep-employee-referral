import { ShieldCheck } from 'lucide-react'

const ERROR_MESSAGES: Record<string, string> = {
  domain: 'Please sign in with your NPrep company Google account.',
  auth_failed: 'Sign-in failed. Please try again.',
}

export default function LoginForm({ errorCode }: { errorCode?: string }) {
  const errorMessage = errorCode ? ERROR_MESSAGES[errorCode] || 'Something went wrong.' : ''

  return (
    <main className="login-page">
      <div className="login-hero fade-in">
        <BrandMark />
        <h1>Share your code. Grow the network.</h1>
        <p>Sign in with your NPrep Google account to get your personal referral code and track what it earns.</p>
      </div>

      <div className="login-card fade-in-delay-1">
        <div className="login-card-badge">
          <ShieldCheck size={22} />
          Sign in
        </div>
        <p>Only @nprep.in company accounts can access this portal.</p>
        {errorMessage ? (
          <p className="login-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <a href="/api/auth/google/start">
          <button className="google-btn">
            <GoogleMark />
            Sign in with Google
          </button>
        </a>
      </div>
    </main>
  )
}

function BrandMark() {
  return (
    <svg className="login-mark" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="24" height="24" rx="8" fill="#22c1dc" />
      <rect x="16" y="16" width="24" height="24" rx="8" fill="#0f1e4d" />
    </svg>
  )
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path fill="#fff" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62z" opacity=".95" />
      <path fill="#fff" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18z" opacity=".8" />
      <path fill="#fff" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.16.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33z" opacity=".65" />
      <path fill="#fff" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58z" opacity=".9" />
    </svg>
  )
}
