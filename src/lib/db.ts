import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import type { CouponRequest, CouponStatus, Employee, EmployeeRole, Payout } from '@/lib/types'

// This app's OWN bookkeeping database - employees, coupon requests, sessions,
// payouts. Completely separate from NPrep's production MySQL (src/lib/nprepDb.ts),
// which is only ever read, never written.
//
// Needs a persistent disk to survive restarts/deploys - this is why the app
// is deployed on Railway (a long-running container with a mounted volume),
// NOT on Vercel serverless, which has no persistent filesystem.
let db: Database.Database | undefined

function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.resolve(process.env.SQLITE_DB_PATH || './data/referral.sqlite')
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.exec(`
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'admin')),
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS coupon_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL UNIQUE REFERENCES employees(id),
        code TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
        usage_limit INTEGER NOT NULL DEFAULT 100,
        activation_date TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        requested_at TEXT NOT NULL,
        admin_notified_at TEXT,
        activated_at TEXT,
        employee_notified_at TEXT
      );

      CREATE TABLE IF NOT EXISTS payouts (
        purchase_id INTEGER PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id),
        coupon_code TEXT,
        incentive_amount INTEGER NOT NULL,
        paid_at TEXT NOT NULL,
        paid_by_admin_id INTEGER REFERENCES employees(id),
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash TEXT PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id),
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS coupon_requests_status_idx ON coupon_requests(status);
    `)
  }
  return db
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/* ------------------------------------------------------------------ */
/* Employees                                                            */
/* ------------------------------------------------------------------ */

export function getEmployeeByEmail(email: string): Employee | null {
  const row = getDb().prepare('SELECT * FROM employees WHERE email = ?').get(email) as Employee | undefined
  return row || null
}

export function getEmployeeById(id: number): Employee | null {
  const row = getDb().prepare('SELECT * FROM employees WHERE id = ?').get(id) as Employee | undefined
  return row || null
}

// Creates the employee row on first Google sign-in, or returns the existing
// one. Role is decided ONCE, at creation - see isBootstrapAdmin in domain.ts.
export function findOrCreateEmployee(email: string, name: string, role: EmployeeRole): Employee {
  const existing = getEmployeeByEmail(email)
  if (existing) return existing
  const now = new Date().toISOString()
  const result = getDb()
    .prepare('INSERT INTO employees (email, name, role, created_at) VALUES (?, ?, ?, ?)')
    .run(email, name, role, now)
  return getEmployeeById(Number(result.lastInsertRowid))!
}

/* ------------------------------------------------------------------ */
/* Sessions                                                             */
/* ------------------------------------------------------------------ */

export function createSession(employeeId: number): { token: string; expiresAt: string } {
  const token = crypto.randomBytes(32).toString('base64url')
  const now = new Date().toISOString()
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  getDb()
    .prepare('INSERT INTO auth_sessions (token_hash, employee_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(hashToken(token), employeeId, expiresAt, now)
  return { token, expiresAt }
}

export function getSessionEmployee(token: string): Employee | null {
  if (!token) return null
  const row = getDb()
    .prepare(`
      SELECT e.*
      FROM auth_sessions s
      JOIN employees e ON e.id = s.employee_id
      WHERE s.token_hash = ? AND s.expires_at > ?
    `)
    .get(hashToken(token), new Date().toISOString()) as Employee | undefined
  return row || null
}

export function deleteSession(token: string): void {
  if (!token) return
  getDb().prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(hashToken(token))
}

/* ------------------------------------------------------------------ */
/* Coupon requests                                                      */
/* ------------------------------------------------------------------ */

export function getCouponRequestByEmployeeId(employeeId: number): CouponRequest | null {
  const row = getDb().prepare('SELECT * FROM coupon_requests WHERE employee_id = ?').get(employeeId) as CouponRequest | undefined
  return row || null
}

export function getCouponRequestByCode(code: string): CouponRequest | null {
  const row = getDb().prepare('SELECT * FROM coupon_requests WHERE code = ?').get(code) as CouponRequest | undefined
  return row || null
}

export function createCouponRequest(input: {
  employeeId: number
  code: string
  usageLimit: number
  activationDate: string
  expiryDate: string
}): CouponRequest {
  const now = new Date().toISOString()
  const result = getDb()
    .prepare(`
      INSERT INTO coupon_requests (employee_id, code, usage_limit, activation_date, expiry_date, requested_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(input.employeeId, input.code, input.usageLimit, input.activationDate, input.expiryDate, now)
  return getDb().prepare('SELECT * FROM coupon_requests WHERE id = ?').get(result.lastInsertRowid) as CouponRequest
}

export function markCouponAdminNotified(id: number): void {
  getDb().prepare('UPDATE coupon_requests SET admin_notified_at = ? WHERE id = ?').run(new Date().toISOString(), id)
}

export function getPendingCouponRequests(): Array<CouponRequest & { employeeName: string; employeeEmail: string }> {
  return getDb()
    .prepare(`
      SELECT cr.*, e.name AS employeeName, e.email AS employeeEmail
      FROM coupon_requests cr
      JOIN employees e ON e.id = cr.employee_id
      WHERE cr.status = 'pending'
      ORDER BY cr.requested_at ASC
    `)
    .all() as Array<CouponRequest & { employeeName: string; employeeEmail: string }>
}

export function activateCouponRequest(id: number): void {
  const now = new Date().toISOString()
  getDb()
    .prepare('UPDATE coupon_requests SET status = ?, activated_at = ?, employee_notified_at = ? WHERE id = ?')
    .run('active', now, now, id)
}

// Every employee who currently has an ACTIVE coupon, keyed by uppercased
// code - used to attribute NPrep purchases back to an employee.
export function getActiveEmployeeByCoupon(): Map<string, { employeeId: number; name: string }> {
  const rows = getDb()
    .prepare(`
      SELECT cr.code, cr.employee_id, e.name
      FROM coupon_requests cr
      JOIN employees e ON e.id = cr.employee_id
      WHERE cr.status = 'active'
    `)
    .all() as Array<{ code: string; employee_id: number; name: string }>
  return new Map(rows.map((row) => [row.code.toUpperCase(), { employeeId: row.employee_id, name: row.name }]))
}

/* ------------------------------------------------------------------ */
/* Payouts                                                              */
/* ------------------------------------------------------------------ */

export function getPaidPayoutMap(purchaseIds: number[]): Map<number, Payout> {
  const ids = [...new Set(purchaseIds.filter(Boolean))]
  if (!ids.length) return new Map()
  const placeholders = ids.map(() => '?').join(',')
  const rows = getDb()
    .prepare(`SELECT * FROM payouts WHERE purchase_id IN (${placeholders})`)
    .all(...ids) as Payout[]
  return new Map(rows.map((row) => [row.purchase_id, row]))
}

export function markPayoutPaid(input: {
  purchaseId: number
  employeeId: number | null
  couponCode: string | null
  incentiveAmount: number
  paidByAdminId: number
}): Payout {
  const now = new Date().toISOString()
  getDb()
    .prepare(`
      INSERT INTO payouts (purchase_id, employee_id, coupon_code, incentive_amount, paid_at, paid_by_admin_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(purchase_id) DO NOTHING
    `)
    .run(input.purchaseId, input.employeeId, input.couponCode, input.incentiveAmount, now, input.paidByAdminId, now)
  return getDb().prepare('SELECT * FROM payouts WHERE purchase_id = ?').get(input.purchaseId) as Payout
}

export { getDb }
export type { CouponStatus }
