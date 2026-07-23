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
        employee_code TEXT,
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

      CREATE TABLE IF NOT EXISTS employee_directory (
        employee_no TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        department TEXT,
        designation TEXT,
        email TEXT
      );

      CREATE INDEX IF NOT EXISTS coupon_requests_status_idx ON coupon_requests(status);
      CREATE INDEX IF NOT EXISTS employee_directory_email_idx ON employee_directory(email);
    `)

    // Migration for databases created before employee_code existed: the
    // CREATE TABLE above only adds the column to a brand-new DB, so an existing
    // production DB needs an explicit ALTER. SQLite can't add a UNIQUE column
    // via ALTER TABLE, so uniqueness is enforced by a separate unique index
    // (NULLs are treated as distinct, so many employees can share "no code").
    const hasEmployeeCode = (db.prepare('PRAGMA table_info(employees)').all() as Array<{ name: string }>).some(
      (column) => column.name === 'employee_code',
    )
    if (!hasEmployeeCode) {
      db.exec('ALTER TABLE employees ADD COLUMN employee_code TEXT')
    }
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS employees_employee_code_idx ON employees(employee_code)')

    // Load the employee directory (the master list of valid Employee Nos) from
    // a `directory.json` sitting next to the DB file, if present. Codes are
    // never typed - they come from here, matched to a login by email. The file
    // lives in the data volume (gitignored, not committed), so updating it +
    // restarting re-syncs the table. Idempotent upsert; best-effort.
    seedDirectoryIfPresent(db, dbPath)
  }
  return db
}

function seedDirectoryIfPresent(database: Database.Database, dbPath: string): void {
  try {
    const jsonPath = path.join(path.dirname(dbPath), 'directory.json')
    if (!fs.existsSync(jsonPath)) return
    const entries = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as Array<{
      employeeNo: string | number
      name: string
      department?: string
      designation?: string
      email?: string
    }>
    if (!Array.isArray(entries) || !entries.length) return
    const stmt = database.prepare(`
      INSERT INTO employee_directory (employee_no, name, department, designation, email)
      VALUES (@employee_no, @name, @department, @designation, @email)
      ON CONFLICT(employee_no) DO UPDATE SET
        name = excluded.name, department = excluded.department,
        designation = excluded.designation, email = excluded.email
    `)
    const run = database.transaction((rows: typeof entries) => {
      for (const row of rows) {
        if (!row || row.employeeNo == null || row.employeeNo === '' || !row.name) continue
        stmt.run({
          employee_no: String(row.employeeNo).trim(),
          name: String(row.name).trim(),
          department: row.department ? String(row.department).trim() : null,
          designation: row.designation ? String(row.designation).trim() : null,
          email: row.email ? String(row.email).trim().toLowerCase() : null,
        })
      }
    })
    run(entries)
  } catch (error) {
    console.error('Directory seed from directory.json failed', error)
  }
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
// one. Role is decided ONCE, at creation - see isBootstrapAdmin in domain.ts,
// or promoteToAdmin below for rows an admin pre-created by email. If the row
// already exists with a placeholder name (see promoteToAdmin), refresh it
// with the real name Google returns on their actual first login.
export function findOrCreateEmployee(email: string, name: string, role: EmployeeRole): Employee {
  const existing = getEmployeeByEmail(email)
  if (existing) {
    if (existing.name !== name) {
      getDb().prepare('UPDATE employees SET name = ? WHERE id = ?').run(name, existing.id)
      return getEmployeeById(existing.id)!
    }
    return existing
  }
  const now = new Date().toISOString()
  const result = getDb()
    .prepare('INSERT INTO employees (email, name, role, created_at) VALUES (?, ?, ?, ?)')
    .run(email, name, role, now)
  return getEmployeeById(Number(result.lastInsertRowid))!
}

export function listAdmins(): Employee[] {
  return getDb().prepare("SELECT * FROM employees WHERE role = 'admin' ORDER BY name").all() as Employee[]
}

// Called when an existing admin adds a new admin by email. If that email has
// already signed in as an employee, promotes their existing row. Otherwise
// creates a placeholder row (name = email's local part) that becomes real the
// moment they actually sign in - see findOrCreateEmployee above.
export function promoteToAdmin(email: string): Employee {
  const existing = getEmployeeByEmail(email)
  if (existing) {
    getDb().prepare("UPDATE employees SET role = 'admin' WHERE id = ?").run(existing.id)
    return getEmployeeById(existing.id)!
  }
  const now = new Date().toISOString()
  const placeholderName = email.split('@')[0]
  const result = getDb()
    .prepare("INSERT INTO employees (email, name, role, created_at) VALUES (?, ?, 'admin', ?)")
    .run(email, placeholderName, now)
  return getEmployeeById(Number(result.lastInsertRowid))!
}

export function getEmployeeByCode(employeeCode: string): Employee | null {
  const row = getDb().prepare('SELECT * FROM employees WHERE employee_code = ?').get(employeeCode) as Employee | undefined
  return row || null
}

// People who have signed in but have no referral code yet: no employee_code
// AND no coupon of their own. With auto-assign-on-login, this means their login
// email wasn't found in the directory (e.g. their directory row lists a
// personal email), so an admin must link them from the "Need attention" panel.
// Anyone who already has a coupon is excluded - nothing to action.
export function getEmployeesNeedingCode(): Employee[] {
  return getDb()
    .prepare(`
      SELECT e.*
      FROM employees e
      LEFT JOIN coupon_requests cr ON cr.employee_id = e.id
      WHERE e.employee_code IS NULL AND cr.id IS NULL
      ORDER BY e.created_at ASC
    `)
    .all() as Employee[]
}

// Admin approval action: assign the employee's code and create their derived
// `NPrep<code>` coupon request in ONE transaction, so we never end up with a
// code set but no coupon (or vice versa) if the second write hits a unique
// constraint. A duplicate employee_code or coupon code makes the whole thing
// throw and roll back - callers should pre-check for friendlier errors.
export function assignEmployeeCodeAndCreateCoupon(input: {
  employeeId: number
  employeeCode: string
  couponCode: string
  usageLimit: number
  activationDate: string
  expiryDate: string
}): { employee: Employee; request: CouponRequest } {
  const database = getDb()
  const now = new Date().toISOString()
  const run = database.transaction(() => {
    database.prepare('UPDATE employees SET employee_code = ? WHERE id = ?').run(input.employeeCode, input.employeeId)
    const result = database
      .prepare(`
        INSERT INTO coupon_requests (employee_id, code, usage_limit, activation_date, expiry_date, requested_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(input.employeeId, input.couponCode, input.usageLimit, input.activationDate, input.expiryDate, now)
    return Number(result.lastInsertRowid)
  })
  const requestId = run()
  return {
    employee: getEmployeeById(input.employeeId)!,
    request: database.prepare('SELECT * FROM coupon_requests WHERE id = ?').get(requestId) as CouponRequest,
  }
}

/* ------------------------------------------------------------------ */
/* Employee directory (master list of valid codes, from directory.json) */
/* ------------------------------------------------------------------ */

export interface DirectoryEntry {
  employee_no: string
  name: string
  department: string | null
  designation: string | null
  email: string | null
}

// Look up a directory entry by login email (case-insensitive). This is how a
// signed-in user's Employee No - and therefore their NPrep<no> code - is
// determined automatically. Returns null if the email isn't in the directory.
export function getDirectoryByEmail(email: string): DirectoryEntry | null {
  const row = getDb()
    .prepare('SELECT * FROM employee_directory WHERE email = ?')
    .get(email.trim().toLowerCase()) as DirectoryEntry | undefined
  return row || null
}

export function getDirectoryByNo(employeeNo: string): DirectoryEntry | null {
  const row = getDb()
    .prepare('SELECT * FROM employee_directory WHERE employee_no = ?')
    .get(String(employeeNo).trim()) as DirectoryEntry | undefined
  return row || null
}

// Directory entries not yet linked to any employee (no employee has this
// employee_no as their code). Used to let an admin link an unmatched login
// by picking the right person - never by typing a code.
export function getUnassignedDirectory(): DirectoryEntry[] {
  return getDb()
    .prepare(`
      SELECT d.*
      FROM employee_directory d
      LEFT JOIN employees e ON e.employee_code = d.employee_no
      WHERE e.id IS NULL
      ORDER BY CAST(d.employee_no AS INTEGER)
    `)
    .all() as DirectoryEntry[]
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

export interface AdminOverviewStats {
  totalEmployees: number
  couponsRequested: number
  couponsActive: number
  couponsPending: number
}

export function getAdminOverviewStats(): AdminOverviewStats {
  const db = getDb()
  const totalEmployees = (db.prepare("SELECT COUNT(*) AS c FROM employees WHERE role = 'employee'").get() as { c: number }).c
  const couponsRequested = (db.prepare('SELECT COUNT(*) AS c FROM coupon_requests').get() as { c: number }).c
  const couponsActive = (db.prepare("SELECT COUNT(*) AS c FROM coupon_requests WHERE status = 'active'").get() as { c: number }).c
  const couponsPending = (db.prepare("SELECT COUNT(*) AS c FROM coupon_requests WHERE status = 'pending'").get() as { c: number }).c
  return { totalEmployees, couponsRequested, couponsActive, couponsPending }
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
