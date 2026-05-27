import { createClient, createServiceClient } from '@/app/_lib/supabase/server'
import { isSameOrigin } from '@/app/_lib/csrf'
import { checkRateLimit } from '@/app/_lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { notes } = await request.json()
  if (typeof notes !== 'string') return NextResponse.json({ error: 'Invalid notes' }, { status: 400 })
  if (notes.length > 8000) return NextResponse.json({ error: 'Notes too long' }, { status: 400 })

  const service = await createServiceClient()
  const allowed = await checkRateLimit(service, user.id, 'notes_update', 30, 3600 * 1000)
  if (!allowed) return NextResponse.json({ error: 'Too many updates. Try again later.' }, { status: 429 })

  const { error } = await supabase
    .from('homeowners')
    .update({ notes })
    .eq('id', id)
    .eq('roofer_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
