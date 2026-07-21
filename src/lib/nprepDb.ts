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

// True if `code` already exists as a real coupon in NPrep (any coupon, not
// just ones tied to an employee) - used to stop an employee from picking a
// code that collides with an unrelated marketing coupon.
export async function nprepCouponExists(code: string): Promise<boolean> {
  const [rows] = await getNprepPool().query<mysql.RowDataPacket[]>(
    'SELECT 1 FROM coupons WHERE UPPER(code) = ? AND deleted_at IS NULL LIMIT 1',
    [code.toUpperCase()],
  )
  return rows.length > 0
}
