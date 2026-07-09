import { createClient } from '@/app/_lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import AdminPanel from './AdminPanel'

const ADMIN_USER_ID = '759e00cd-34ae-45c7-b56f-e8f8cf4eed36'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (user.id !== ADMIN_USER_ID) notFound()

  return (
    <div className="min-h-screen bg-zinc-950 p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Customers</h1>
        <p className="text-zinc-500 text-sm mb-8">Subscriptions, engagement, and billing across every contractor.</p>
        <AdminPanel />
      </div>
    </div>
  )
}
