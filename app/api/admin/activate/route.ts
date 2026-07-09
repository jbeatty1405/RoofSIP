import { createClient } from '@/app/_lib/supabase/server'
import { createClient as createServiceRoleClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const ADMIN_USER_ID = '759e00cd-34ae-45c7-b56f-e8f8cf4eed36'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { email, action } = await request.json()
  if (!email || !['activate', 'deactivate'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // True service-role client (no user cookie) so RLS is bypassed and we can look
  // up any user and update another contractor's profile. The cookie-based
  // createServiceClient() authorizes as the logged-in admin, so RLS would block
  // the cross-user update (0 rows) and the GoTrue admin API would be unauthorized.
  const service = createServiceRoleClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\s/g, ''),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.replace(/\s/g, ''),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // Find user by email
  const { data: { users }, error: lookupErr } = await service.auth.admin.listUsers()
  if (lookupErr) return NextResponse.json({ error: 'Failed to list users' }, { status: 500 })

  const target = users.find(u => u.email?.toLowerCase() === email.toLowerCase())
  if (!target) return NextResponse.json({ error: `No user found with email ${email}` }, { status: 404 })

  const status = action === 'activate' ? 'active' : 'inactive'
  const { error: updateErr } = await service
    .from('profiles')
    .update({ subscription_status: status })
    .eq('id', target.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, userId: target.id, status })
}
