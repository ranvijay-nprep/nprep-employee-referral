export type EmployeeRole = 'employee' | 'admin'
export type CouponStatus = 'pending' | 'active' | 'rejected'

export interface Employee {
  id: number
  email: string
  name: string
  role: EmployeeRole
  created_at: string
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
