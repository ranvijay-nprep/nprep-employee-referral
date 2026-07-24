import { listMessageTemplates } from '@/lib/db'
import MessageManager from '@/components/MessageManager'

export default async function AdminMessagesPage() {
  return (
    <>
      <header className="admin-page-header">
        <h1>Messages</h1>
        <p>The exact text employees send to students. Changes go live immediately — nothing needs redeploying.</p>
      </header>
      <MessageManager templates={listMessageTemplates()} />
    </>
  )
}
