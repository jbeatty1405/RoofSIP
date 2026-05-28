import { createClient, createServiceClient } from '@/app/_lib/supabase/server'
import { NextResponse } from 'next/server'

const ADMIN_USER_ID = '759e00cd-34ae-45c7-b56f-e8f8cf4eed36'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const service = await createServiceClient()
  const { data: profiles } = await service
    .from('profiles')
    .select('id, pm_name, company_name, subscription_status, stripe_customer_id, created_at')
    .order('created_at', { ascending: false })

  const { data: { users } } = await service.auth.admin.listUsers()
  const emailMap = Object.fromEntries(users.map(u => [u.id, u.email]))

  const result = (profiles ?? []).map(p => ({
    ...p,
    email: emailMap[p.id] ?? '—',
  }))

  return NextResponse.json(result)
}
