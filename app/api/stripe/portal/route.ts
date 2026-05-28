import { createClient } from '@/app/_lib/supabase/server'
import { createPortalSession } from '@/app/_lib/stripe'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Accept Bearer token from mobile app as fallback to cookie session
  const authHeader = request.headers.get('Authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const { data: { user } } = bearerToken
    ? await supabase.auth.getUser(bearerToken)
    : await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'No subscription on file' }, { status: 400 })
  }

  const appUrl = new URL(request.url).origin
  const url = await createPortalSession(profile.stripe_customer_id, appUrl)
  return NextResponse.json({ url })
}
