import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { MESSAGE_TEMPLATES } from '@/lib/messages'
import { normalizePhone } from '@/lib/phone'
import type {
  CouponRequest,
  CouponStatus,
  Employee,
  EmployeeRole,
  EmployeeWithProfile,
  MessageTemplate,
  Payout,
  ReferralShare,
} from '@/lib/types'

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

      -- Who an employee actually sent their coupon to. A coupon is a broadcast
      -- code, so nothing else in the system knows this - the employee records
      -- it when they share, and a purchase is matched back by phone number.
      CREATE TABLE IF NOT EXISTS referral_shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL REFERENCES employees(id),
        coupon_code TEXT NOT NULL,
        referee_name TEXT NOT NULL,
        referee_phone TEXT NOT NULL,
        channel TEXT NOT NULL DEFAULT 'whatsapp',
        note TEXT,
        shared_at TEXT NOT NULL,
        last_reminded_at TEXT,
        UNIQUE (employee_id, referee_phone)
      );

      -- Admin-editable copy for the messages employees send out. Seeded from
      -- MESSAGE_TEMPLATES (src/lib/messages.ts) on first run.
      CREATE TABLE IF NOT EXISTS message_templates (
        key TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by INTEGER REFERENCES employees(id)
      );

      CREATE INDEX IF NOT EXISTS coupon_requests_status_idx ON coupon_requests(status);
      CREATE INDEX IF NOT EXISTS employee_directory_email_idx ON employee_directory(email);
      CREATE INDEX IF NOT EXISTS referral_shares_employee_idx ON referral_shares(employee_id);
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
    seedMessageTemplates(db)
  }
  return db
}

// Inserts any built-in template that isn't in the table yet, and keeps the
// title/description (developer-owned labels) in sync. The BODY is only ever
// written on first insert - once an admin has edited the copy, that edit wins
// and a later change to the default must not silently revert it.
function seedMessageTemplates(database: Database.Database): void {
  const now = new Date().toISOString()
  const stmt = database.prepare(`
    INSERT INTO message_templates (key, title, description, body, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET title = excluded.title, description = excluded.description
  `)
  const run = database.transaction(() => {
    for (const template of MESSAGE_TEMPLATES) {
      stmt.run(template.key, template.title, template.description, template.body, now)
    }
  })
  run()
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

// Joins `employees` to its `employee_directory` entry so every screen can show
// department/designation without storing (and having to re-sync) them on the
// employee row.
//
// Two independent joins rather than one OR'd join: the assigned code is the
// authoritative match and wins, but the email match is ALWAYS available as a
// fallback. (An OR would silently blank someone's department the moment they
// got a code that no directory row carries - e.g. after a directory re-import
// renumbered them.) GROUP BY guards against a directory that ever ends up with
// two rows for one email.
const EMPLOYEE_PROFILE_SELECT = `
  SELECT e.*,
         COALESCE(byCode.name, byEmail.name)               AS directory_name,
         COALESCE(byCode.department, byEmail.department)   AS department,
         COALESCE(byCode.designation, byEmail.designation) AS designation
  FROM employees e
  LEFT JOIN employee_directory byCode ON byCode.employee_no = e.employee_code
  LEFT JOIN employee_directory byEmail ON byEmail.email = e.email
`

// An employee row created by promoteToAdmin (or by a sign-in Google had no
// name for) carries the email's local part as a placeholder - "drprince"
// rather than a person's name. Whenever the directory knows better, show that
// instead. A real name from Google is never overridden.
function withDisplayName(row: EmployeeWithProfile): EmployeeWithProfile {
  const looksLikePlaceholder = row.name === row.email.split('@')[0]
  return looksLikePlaceholder && row.directory_name ? { ...row, name: row.directory_name } : row
}

export function listAdminsWithProfile(): EmployeeWithProfile[] {
  const rows = getDb()
    .prepare(`${EMPLOYEE_PROFILE_SELECT} WHERE e.role = 'admin' GROUP BY e.id ORDER BY e.name`)
    .all() as EmployeeWithProfile[]
  return rows.map(withDisplayName)
}

export function getEmployeeWithProfile(id: number): EmployeeWithProfile | null {
  const row = getDb()
    .prepare(`${EMPLOYEE_PROFILE_SELECT} WHERE e.id = ? GROUP BY e.id`)
    .get(id) as EmployeeWithProfile | undefined
  return row ? withDisplayName(row) : null
}

export function listEmployeesWithProfile(): EmployeeWithProfile[] {
  const rows = getDb().prepare(`${EMPLOYEE_PROFILE_SELECT} GROUP BY e.id ORDER BY e.name`).all() as EmployeeWithProfile[]
  return rows.map(withDisplayName)
}

export function countAdmins(): number {
  return (getDb().prepare("SELECT COUNT(*) AS c FROM employees WHERE role = 'admin'").get() as { c: number }).c
}

// Called when an existing admin adds a new admin by email. If that email has
// already signed in as an employee, promotes their existing row. Otherwise
// creates a placeholder row that becomes real the moment they actually sign in
// (see findOrCreateEmployee above). The placeholder name comes from the
// employee directory when that email is in it, and only falls back to the
// email's local part when it isn't.
export function promoteToAdmin(email: string): Employee {
  const existing = getEmployeeByEmail(email)
  if (existing) {
    getDb().prepare("UPDATE employees SET role = 'admin' WHERE id = ?").run(existing.id)
    return getEmployeeById(existing.id)!
  }
  const now = new Date().toISOString()
  const placeholderName = getDirectoryByEmail(email)?.name || email.split('@')[0]
  const result = getDb()
    .prepare("INSERT INTO employees (email, name, role, created_at) VALUES (?, ?, 'admin', ?)")
    .run(email, placeholderName, now)
  return getEmployeeById(Number(result.lastInsertRowid))!
}

// Removing an admin only drops the role - the row, their referral code and
// every purchase attributed to it stay exactly as they were, so demoting
// someone never destroys payout history. They keep normal referrer access.
export function demoteFromAdmin(employeeId: number): void {
  getDb().prepare("UPDATE employees SET role = 'employee' WHERE id = ?").run(employeeId)
}

export function getEmployeeByCode(employeeCode: string): Employee | null {
  const row = getDb().prepare('SELECT * FROM employees WHERE employee_code = ?').get(employeeCode) as Employee | undefined
  return row || null
}

// People an admin genuinely has to act on: no code, no coupon, AND no
// directory row matching their login email.
//
// That last condition is the whole point of the panel and used to be missing.
// Anyone whose email IS in the directory gets their code automatically on
// their next authenticated request (see ensureReferralForLogin), so listing
// them as "needs attention" is noise an admin can do nothing about - and it
// also surfaced placeholder rows created by promoteToAdmin for people who
// have never signed in at all.
export function getEmployeesNeedingCode(): Employee[] {
  return getDb()
    .prepare(`
      SELECT e.*
      FROM employees e
      LEFT JOIN coupon_requests cr ON cr.employee_id = e.id
      LEFT JOIN employee_directory d ON d.email = e.email
      WHERE e.employee_code IS NULL AND cr.id IS NULL AND d.employee_no IS NULL
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

export interface PendingCouponRequest extends CouponRequest {
  employeeName: string
  employeeEmail: string
  employeeDepartment: string | null
  employeeDesignation: string | null
}

export function getPendingCouponRequests(): PendingCouponRequest[] {
  return getDb()
    .prepare(`
      SELECT cr.*,
             COALESCE(NULLIF(e.name, ''), byCode.name, byEmail.name)  AS employeeName,
             e.email AS employeeEmail,
             COALESCE(byCode.department, byEmail.department)          AS employeeDepartment,
             COALESCE(byCode.designation, byEmail.designation)        AS employeeDesignation
      FROM coupon_requests cr
      JOIN employees e ON e.id = cr.employee_id
      LEFT JOIN employee_directory byCode ON byCode.employee_no = e.employee_code
      LEFT JOIN employee_directory byEmail ON byEmail.email = e.email
      WHERE cr.status = 'pending'
      GROUP BY cr.id
      ORDER BY cr.requested_at ASC
    `)
    .all() as PendingCouponRequest[]
}

export interface AdminOverviewStats {
  totalEmployees: number
  couponsRequested: number
  couponsActive: number
  couponsPending: number
  refereesTracked: number
}

export function getAdminOverviewStats(): AdminOverviewStats {
  const db = getDb()
  // Every signed-up person, admins included - admins are referrers too (they
  // get their own code from the same auto-assign path), so excluding them
  // under-reported the headcount.
  const totalEmployees = (db.prepare('SELECT COUNT(*) AS c FROM employees').get() as { c: number }).c
  const couponsRequested = (db.prepare('SELECT COUNT(*) AS c FROM coupon_requests').get() as { c: number }).c
  const couponsActive = (db.prepare("SELECT COUNT(*) AS c FROM coupon_requests WHERE status = 'active'").get() as { c: number }).c
  const couponsPending = (db.prepare("SELECT COUNT(*) AS c FROM coupon_requests WHERE status = 'pending'").get() as { c: number }).c
  const refereesTracked = (db.prepare('SELECT COUNT(*) AS c FROM referral_shares').get() as { c: number }).c
  return { totalEmployees, couponsRequested, couponsActive, couponsPending, refereesTracked }
}

export function activateCouponRequest(id: number): void {
  const now = new Date().toISOString()
  getDb()
    .prepare('UPDATE coupon_requests SET status = ?, activated_at = ?, employee_notified_at = ? WHERE id = ?')
    .run('active', now, now, id)
}

export interface CouponOwner {
  employeeId: number
  name: string
  department: string | null
  designation: string | null
}

// Every employee who currently has an ACTIVE coupon, keyed by uppercased
// code - used to attribute NPrep purchases back to an employee, and to their
// department for the analytics dashboard.
export function getActiveEmployeeByCoupon(): Map<string, CouponOwner> {
  const rows = getDb()
    .prepare(`
      SELECT cr.code, cr.employee_id, e.name, e.email,
             COALESCE(byCode.name, byEmail.name)               AS directory_name,
             COALESCE(byCode.department, byEmail.department)   AS department,
             COALESCE(byCode.designation, byEmail.designation) AS designation
      FROM coupon_requests cr
      JOIN employees e ON e.id = cr.employee_id
      LEFT JOIN employee_directory byCode ON byCode.employee_no = e.employee_code
      LEFT JOIN employee_directory byEmail ON byEmail.email = e.email
      WHERE cr.status = 'active'
      GROUP BY cr.id
    `)
    .all() as Array<{
    code: string
    employee_id: number
    name: string
    email: string
    directory_name: string | null
    department: string | null
    designation: string | null
  }>
  return new Map(
    rows.map((row) => [
      row.code.toUpperCase(),
      {
        employeeId: row.employee_id,
        name: row.name === row.email.split('@')[0] && row.directory_name ? row.directory_name : row.name,
        department: row.department,
        designation: row.designation,
      },
    ]),
  )
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

/* ------------------------------------------------------------------ */
/* Referee tracker (who an employee shared their coupon with)           */
/* ------------------------------------------------------------------ */

export function listSharesByEmployee(employeeId: number): ReferralShare[] {
  return getDb()
    .prepare('SELECT * FROM referral_shares WHERE employee_id = ? ORDER BY shared_at DESC')
    .all(employeeId) as ReferralShare[]
}

export function listAllShares(): ReferralShare[] {
  return getDb().prepare('SELECT * FROM referral_shares').all() as ReferralShare[]
}

export function getShareById(id: number): ReferralShare | null {
  const row = getDb().prepare('SELECT * FROM referral_shares WHERE id = ?').get(id) as ReferralShare | undefined
  return row || null
}

// Recording a share is idempotent on (employee, phone): re-sharing with the
// same person updates the name/note and refreshes nothing else, rather than
// creating a duplicate row that would double-count in the tracker.
export function recordShare(input: {
  employeeId: number
  couponCode: string
  refereeName: string
  refereePhone: string
  channel: string
  note: string | null
}): ReferralShare {
  const phone = normalizePhone(input.refereePhone)
  const now = new Date().toISOString()
  getDb()
    .prepare(`
      INSERT INTO referral_shares (employee_id, coupon_code, referee_name, referee_phone, channel, note, shared_at)
      VALUES (@employee_id, @coupon_code, @referee_name, @referee_phone, @channel, @note, @shared_at)
      ON CONFLICT(employee_id, referee_phone) DO UPDATE SET
        referee_name = excluded.referee_name,
        note = COALESCE(excluded.note, referral_shares.note),
        channel = excluded.channel
    `)
    .run({
      employee_id: input.employeeId,
      coupon_code: input.couponCode,
      referee_name: input.refereeName,
      referee_phone: phone,
      channel: input.channel,
      note: input.note,
      shared_at: now,
    })
  return getDb()
    .prepare('SELECT * FROM referral_shares WHERE employee_id = ? AND referee_phone = ?')
    .get(input.employeeId, phone) as ReferralShare
}

export function markShareReminded(id: number, employeeId: number): void {
  getDb()
    .prepare('UPDATE referral_shares SET last_reminded_at = ?, channel = ? WHERE id = ? AND employee_id = ?')
    .run(new Date().toISOString(), 'whatsapp', id, employeeId)
}

// Scoped by employee_id on purpose: the id alone must not be enough to delete
// someone else's row.
export function deleteShare(id: number, employeeId: number): boolean {
  const result = getDb().prepare('DELETE FROM referral_shares WHERE id = ? AND employee_id = ?').run(id, employeeId)
  return result.changes > 0
}

/* ------------------------------------------------------------------ */
/* Message templates                                                    */
/* ------------------------------------------------------------------ */

export function listMessageTemplates(): MessageTemplate[] {
  return getDb()
    .prepare(`
      SELECT t.key, t.title, t.description, t.body, t.updated_at, e.name AS updated_by_name
      FROM message_templates t
      LEFT JOIN employees e ON e.id = t.updated_by
      ORDER BY t.rowid
    `)
    .all() as MessageTemplate[]
}

export function getMessageTemplateBody(key: string): string | null {
  const row = getDb().prepare('SELECT body FROM message_templates WHERE key = ?').get(key) as { body: string } | undefined
  return row ? row.body : null
}

// Returns every template body keyed by name, for handing to a client component
// in one go (the referrer dashboard needs three of them at once).
export function getMessageTemplateMap(): Record<string, string> {
  const rows = getDb().prepare('SELECT key, body FROM message_templates').all() as Array<{ key: string; body: string }>
  return Object.fromEntries(rows.map((row) => [row.key, row.body]))
}

export function updateMessageTemplate(key: string, body: string, adminId: number): MessageTemplate | null {
  const result = getDb()
    .prepare('UPDATE message_templates SET body = ?, updated_at = ?, updated_by = ? WHERE key = ?')
    .run(body, new Date().toISOString(), adminId, key)
  if (!result.changes) return null
  return listMessageTemplates().find((template) => template.key === key) ?? null
}

export { getDb }
export type { CouponStatus }
