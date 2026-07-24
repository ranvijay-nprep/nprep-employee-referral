# NPrep Employee Referral Portal

Internal tool: NPrep employees sign in with their company Google account and
get a referral coupon code to share. Codes are **not** employee-chosen - each
is derived as `NPrep<employee_code>` from an internal code an admin assigns.
Purchases made with that code are attributed back to the employee for a sales
incentive - separate from, and much simpler than, the external navigator-ts
portal.

Stack: **Next.js (App Router) + SQLite (better-sqlite3) + a hand-rolled Google
OAuth login + Resend**, deployed on **Railway** (a persistent container, not
serverless - see "Why not Vercel" below).

## Why not Vercel / Supabase

This started out on Vercel + Supabase. Two things pushed it back to
SQLite + a persistent host:

1. **Vercel serverless has no persistent filesystem** - functions run in
   short-lived, isolated containers; only `/tmp` is writable and it's wiped
   between invocations, sometimes between consecutive requests. SQLite needs
   a disk that survives across requests, which Vercel fundamentally doesn't
   offer.
2. Supabase's free tier caps you at 2 active free projects **per account**
   (not per organization), which became a real blocker.

So this app runs on Railway - a normal long-lived Node process with a
persistent disk - exactly like the original navigator-ts app runs on its own
VM. That also means the coupon-activation check (see below) can run as an
**in-process schedule** (`server.ts`, via `node-cron`) instead of needing an
external cron service.

`server.ts` is a small custom server (run via `tsx`, mirroring navigator-ts's
own production entrypoint) rather than Next.js's `instrumentation.ts` hook -
Next.js compiles `instrumentation.ts` for both the edge and nodejs runtimes,
and the edge bundle cannot resolve `better-sqlite3`'s native bindings no
matter how the import is deferred/guarded. A plain Node process sidesteps
that structural issue entirely.

## Read-only guarantee

This app only ever *reads* from NPrep's production MySQL database (see
`src/lib/nprepDb.ts` - purchases, and whether a coupon code exists). It never
writes to it. All of this app's own data (employees, coupon requests,
sessions, payout bookkeeping) lives in its own local SQLite file.

The `NPREP_DB_*` credentials **must** belong to a MySQL user with `SELECT`
grants only. Do not grant `INSERT`/`UPDATE`/`DELETE` on NPrep's database to
this app's credentials, even if a future change seems to need it - re-derive
the design instead.

## Auth

No third-party auth framework - a small hand-rolled Google OAuth2
(authorization-code flow, `src/lib/googleAuth.ts`) plus a session-cookie
table (`auth_sessions` in `src/lib/db.ts`: random token, SHA-256-hashed,
looked up per request). This mirrors navigator-ts's own OTP-session pattern
(`server/referralStore.ts`) - same style, Google establishes identity instead
of an OTP.

Sign-in is restricted to `ALLOWED_EMAIL_DOMAIN` (checked server-side in
`src/app/auth/callback/route.ts` - the `hd` param on the Google auth URL is
only a UI hint, not a security boundary).

## How a coupon actually goes live (there is a manual step, by design)

1. Employee signs in. If no employee code has been assigned to them yet, they
   see a "ask an admin to add your employee code" message and show up in the
   admin **Need attention** panel (`/admin`). Employees do not pick codes.
2. An admin opens the **Need attention** panel, enters the employee's internal
   code, and approves. This derives the coupon as `NPrep<employee_code>`,
   checks it against this app's own `coupon_requests` table and NPrep's real
   `coupons` table, and - in one transaction - stores the employee code and
   creates the coupon request. It then emails **every current admin** (fetched
   live from the `employees` table, not a static env var) with the code,
   activation date, expiry date (+6 months), and usage limit (100).
3. **A human creates the actual coupon in NPrep's own admin system** using
   those exact details. This app cannot and does not do this step itself -
   see the read-only guarantee above.
4. Every 30 minutes, an in-process schedule (`server.ts`, only active when
   run via `npm start` - not under `next dev`) checks whether that code now
   exists in NPrep. Once it does, the request flips to `active` and the
   employee gets an automatic "you can share it now" email.

The admin dashboard (`/admin`) also lists pending requests directly, as a
fallback in case an email gets lost.

## Department & designation

Neither is stored on the `employees` row. Both are read live from
`employee_directory` (seeded from `data/directory.json`) via a join that
prefers the assigned employee code and falls back to the login email - see
`EMPLOYEE_PROFILE_SELECT` in `src/lib/db.ts`. Re-importing the directory file
therefore updates every screen at once, with no migration and nothing to
re-sync. The same join is what makes an admin added by email show up under
their real name instead of the email's local part.

## Referee tracker (who actually bought)

A coupon is a broadcast code, so NPrep's purchase rows carry no notion of
*who an employee sent it to*. The tracker closes that gap:

1. The employee sends their coupon to someone from the referrer dashboard -
   name + mobile number - which opens WhatsApp with the message prefilled and
   records a `referral_shares` row.
2. Status is never stored. On every load, `src/lib/shares.ts` matches that
   number against `users.phone_number` on purchases made with the employee's
   coupon, so a purchase later refunded in NPrep stops reading as converted on
   its own. Both sides go through `normalizePhone` first, so `+91 98765 43210`
   and `9876543210` are the same person.
3. Anyone still unconverted gets a one-click WhatsApp reminder.

If NPrep's DB can't be reached the tracker says so rather than showing
everyone as "not purchased yet", which would look like a real zero.

## Message management

Every message an employee sends a student lives in the `message_templates`
table and is edited by admins at `/admin` - the WhatsApp first-share, the
WhatsApp reminder, the copy/paste text, and an optional notice banner shown on
the referrer dashboard. `src/lib/messages.ts` holds the built-in defaults
(used to seed the table and as a fallback) plus the `{{code}}` / `{{name}}` /
`{{discount}}` / `{{referrer}}` / `{{link}}` substitution both the admin
preview and the employee's browser share.

Editing copy needs no deploy. Seeding only ever inserts - it re-syncs each
template's title/description but never overwrites a body an admin has edited.

## Analytics (`/admin/analytics`)

Top performers, department-wise breakdowns, a monthly trend and the plan mix,
all derived from a single pass over the same rows the payout report uses
(`buildAnalytics` in `src/lib/analytics.ts` is pure, so the numbers can never
disagree with the payouts screen). Referrers with an active code and no sales
stay on the leaderboard rather than vanishing from it.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in every value
npm run dev
```

You'll need:

- **A Google Cloud OAuth client** - console.cloud.google.com → APIs &
  Services → Credentials → OAuth client ID → Web application. Authorized
  redirect URI: `http://localhost:3000/auth/callback` for local dev, plus
  your production domain's `/auth/callback` once deployed.
- **A Resend account** and a verified sending domain, for `RESEND_API_KEY`.
- **Read-only credentials** to NPrep's MySQL database.
- `CRON_SECRET` - only needed if you want to manually trigger
  `/api/cron/check-coupon-activation` over HTTP for debugging; the real
  schedule doesn't need it.

The SQLite file is created automatically at `SQLITE_DB_PATH` on first run
(schema included in `src/lib/db.ts`).

## Deploying to Railway

1. Push this folder to its own Git repo (kept separate from `navigator-ts` -
   different stack).
2. Create a new Railway project from that repo. Set the build command to
   `npm run build` and the start command to `npm start` (the custom
   `server.ts`, not Next's own `next start` - see "Why not Vercel / Supabase"
   above for why).
3. **Add a Volume** and mount it (e.g. at `/data`), then set
   `SQLITE_DB_PATH=/data/referral.sqlite`. Without this, the SQLite file
   lives on the container's ephemeral disk and is lost on every redeploy.
4. Set every env var from `.env.example` in Railway's service settings.
5. Update the Google Cloud OAuth client's authorized redirect URI to your
   Railway domain's `/auth/callback` once you know it.

## What's intentionally not built (yet)

- Click-tracking on shared codes. The referee tracker above is *self-reported*
  (the employee records who they sent it to); nothing instruments the link
  itself, so a code forwarded on by a student is invisible to it.
- Removing an admin only drops the role - it never deletes the employee row,
  their code, or their referral history, and an admin can't remove themselves.
- Automated bank-transfer payouts - "Mark Paid" here is bookkeeping only, same
  as in navigator-ts; real payment should go through payroll for tax/TDS
  compliance reasons (employees are on payroll, not external contractors).
- An admin UI to manually reject a coupon request - currently only `pending`
  and `active` are reachable from the app; set `status='rejected'` directly
  in the SQLite `coupon_requests` table if a request needs to be declined.
