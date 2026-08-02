import mysql from 'mysql2/promise'

// Read-only connection to NPrep's production MySQL database. The credentials
// in NPREP_DB_* MUST belong to a DB user with SELECT-only grants - this file
// must never issue an INSERT/UPDATE/DELETE. See README.md "Read-only
// guarantee" for how this is enforced operationally.
let pool: mysql.Pool | undefined

export function getNprepPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.NPREP_DB_HOST,
      port: Number(process.env.NPREP_DB_PORT || 3306),
      user: process.env.NPREP_DB_USER,
      password: process.env.NPREP_DB_PASSWORD,
      database: process.env.NPREP_DB_NAME,
      // Serverless-friendly: small pool, connections aren't kept alive across
      // invocations anyway. Keep this low to avoid exhausting NPrep's max
      // connections under Vercel's concurrent function instances.
      connectionLimit: 3,
      waitForConnections: true,
      queueLimit: 0,
    })
  }
  return pool
}

export interface NprepCoupon {
  id: number
  code: string
  // IST calendar dates, ready for the portal to store/display.
  activationDate: string | null
  expiryDate: string | null
  usageLimit: number | null
}

// The live NPrep coupon for `code`, or null. Used both to spot collisions and -
// when the code is an employee's own NPrep<empNo> - to adopt their pre-created
// coupon with its real validity window rather than inventing dates.
export async function getNprepCoupon(code: string): Promise<NprepCoupon | null> {
  const [rows] = await getNprepPool().query<mysql.RowDataPacket[]>(
    `SELECT id, code, activation_start_time, expiration_date, usage_limit
     FROM coupons WHERE UPPER(code) = ? AND deleted_at IS NULL LIMIT 1`,
    [code.toUpperCase()],
  )
  const row = rows[0]
  if (!row) return null
  return {
    id: Number(row.id),
    code: String(row.code),
    activationDate: istCalendarDate(row.activation_start_time),
    expiryDate: istCalendarDate(row.expiration_date),
    usageLimit: row.usage_limit == null ? null : Number(row.usage_limit),
  }
}

// True if `code` already exists as a real coupon in NPrep (any coupon, not
// just ones tied to an employee) - used to stop an employee from picking a
// code that collides with an unrelated marketing coupon.
export async function nprepCouponExists(code: string): Promise<boolean> {
  return (await getNprepCoupon(code)) !== null
}

// NPrep stores coupon validity as UTC instants standing for IST midnight, so
// the raw UTC date is a day early. Shift to IST before taking the date part.
function istCalendarDate(value: unknown): string | null {
  if (!value) return null
  const ms = new Date(value as string | Date).getTime()
  if (Number.isNaN(ms)) return null
  return new Date(ms + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
