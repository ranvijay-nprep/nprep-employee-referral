import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSessionEmployee } from '@/lib/db'
import { SESSION_COOKIE } from '@/lib/cookies'
import type { Employee } from '@/lib/types'

export interface Session {
  userId: number
  email: string
  employee: Employee
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value || ''
  const employee = getSessionEmployee(token)
  if (!employee) return null
  return { userId: employee.id, email: employee.email, employee }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession()
  if (session.employee.role !== 'admin') redirect('/')
  return session
}
