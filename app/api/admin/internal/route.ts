import { createClient } from '@/app/_lib/supabase/server'
import { createClient as createServiceRoleClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const ADMIN_USER_ID = '759e00cd-34ae-45c7-b56f-e8f8cf4eed36'

export const dynamic = 'force-dynamic'

// Toggle a profile's is_internal flag. Internal seats (Prowest's own team) are
// excluded from the external subscriber count + MRR so those headline numbers
// reflect real paying customers.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { userId, internal } = await request.json()
  if (!userId || typeof internal !== 'boolean') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const service = createServiceRoleClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\s/g, ''),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.replace(/\s/g, ''),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { error } = await service
    .from('profiles')
    .update({ is_internal: internal })
    .eq('id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, userId, internal })
}
