import { requireAdmin } from '@/lib/auth'
import { listAdminsWithProfile } from '@/lib/db'
import AdminsPanel from '@/components/AdminsPanel'

export default async function AdminTeamPage() {
  const session = await requireAdmin()
  return (
    <>
      <header className="admin-page-header">
        <h1>Admins</h1>
        <p>Who can see this panel, approve coupons and edit the message templates.</p>
      </header>
      <AdminsPanel admins={listAdminsWithProfile()} currentAdminId={session.employee.id} />
    </>
  )
}
