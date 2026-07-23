export type EmployeeRole = 'employee' | 'admin'
export type CouponStatus = 'pending' | 'active' | 'rejected'

export interface Employee {
  id: number
  email: string
  name: string
  role: EmployeeRole
  // The employee's internal NPrep code, assigned by an admin. Their referral
  // coupon is derived from it as `NPrep<employee_code>`. Null until an admin
  // sets it - while null, the employee is shown a "ask an admin to add your
  // code" message and appears in the admin "Need attention" panel.
  employee_code: string | null
  created_at: string
}

// An employee row joined to their `employee_directory` entry (matched on
// employee_code, or on email while they have no code yet). Department and
// designation are never stored on `employees` - the directory file is the
// single source of truth, so re-seeding it updates every screen at once.
export interface EmployeeWithProfile extends Employee {
  directory_name: string | null
  department: string | null
  designation: string | null
}

export interface CouponRequest {
  id: number
  employee_id: number
  code: string
  status: CouponStatus
  usage_limit: number
  activation_date: string
  expiry_date: string
  requested_at: string
  admin_notified_at: string | null
  activated_at: string | null
  employee_notified_at: string | null
}

export interface Payout {
  purchase_id: number
  employee_id: number | null
  coupon_code: string | null
  incentive_amount: number
  paid_at: string
  paid_by_admin_id: number | null
  created_at: string
}

// Purchase rows read (read-only) from NPrep's MySQL, joined/matched against
// coupon_requests by code in application code - see src/lib/report.ts.
export interface NprepPurchaseRow {
  purchase_id: number
  user_id: number
  student_name: string | null
  student_phone: string | null
  student_email: string | null
  plan_id: number
  plan_name: string | null
  duration: number | null
  unit: string | null
  price: number | string | null
  status: string
  is_active: number
  created_at: string | Date | null
  activated_at: string | Date | null
  coupon_code: string | null
}

export interface ReferralRow {
  purchaseId: number
  studentName: string
  studentPhone: string
  planName: string
  planDuration: string
  price: number
  status: string
  isSuccessful: boolean
  couponCode: string | null
  employeeId: number | null
  employeeName: string | null
  employeeDepartment: string | null
  employeeDesignation: string | null
  createdAt: string | null
  incentiveAmount: number
  isPaid: boolean
  paidAt: string | null
}

export interface ReferralSummary {
  total: number
  successful: number
  failed: number
  pending: number
  revenue: number
  incentive: number
  receivable: number
}

/* ------------------------------------------------------------------ */
/* Referee tracker                                                      */
/* ------------------------------------------------------------------ */

// One person an employee shared their coupon with. Rows are created by the
// employee themselves (when they hit "Share on WhatsApp" or add someone by
// hand) - this app has no other way to know who a broadcast code reached.
export interface ReferralShare {
  id: number
  employee_id: number
  coupon_code: string
  referee_name: string
  // Normalised to the bare 10-digit national number - see src/lib/phone.ts.
  // This is what a NPrep purchase is matched against.
  referee_phone: string
  channel: string
  note: string | null
  shared_at: string
  last_reminded_at: string | null
}

// 'purchased'  - a successful purchase on this coupon from that phone number
// 'in_progress'- a purchase exists but hasn't completed (checkout started)
// 'failed'     - their only attempt(s) on this coupon failed
// 'waiting'    - shared, no purchase attempt seen yet
export type ShareStatus = 'purchased' | 'in_progress' | 'failed' | 'waiting'

export interface ReferralShareRow extends ReferralShare {
  status: ShareStatus
  purchaseId: number | null
  purchasedAt: string | null
  planName: string | null
  amount: number | null
  incentiveAmount: number
  daysSinceShared: number
}

/* ------------------------------------------------------------------ */
/* Message templates                                                    */
/* ------------------------------------------------------------------ */

export interface MessageTemplate {
  key: string
  title: string
  description: string
  body: string
  updated_at: string
  updated_by_name: string | null
}

/* ------------------------------------------------------------------ */
/* Analytics                                                            */
/* ------------------------------------------------------------------ */

export interface PerformerStat {
  employeeId: number
  name: string
  department: string
  designation: string
  couponCode: string
  total: number
  successful: number
  revenue: number
  incentive: number
  conversionRate: number
}

export interface DepartmentStat {
  department: string
  referrers: number
  activeReferrers: number
  total: number
  successful: number
  revenue: number
  incentive: number
  conversionRate: number
}

export interface MonthlyStat {
  month: string
  total: number
  successful: number
  revenue: number
}

export interface AnalyticsPayload {
  generatedAt: string
  headline: {
    referrersWithCode: number
    referrersWithSale: number
    total: number
    successful: number
    revenue: number
    incentive: number
    receivable: number
    conversionRate: number
    sharesTracked: number
    sharesConverted: number
  }
  topPerformers: PerformerStat[]
  departments: DepartmentStat[]
  monthly: MonthlyStat[]
  planMix: Array<{ planName: string; successful: number; revenue: number }>
}
