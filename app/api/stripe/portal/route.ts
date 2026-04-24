import { createClient } from '@/app/_lib/supabase/server'
import { createPortalSession } from '@/app/_lib/stripe'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { customerId } = await request.json()
  const url = await createPortalSession(customerId)
  return NextResponse.json({ url })
}
