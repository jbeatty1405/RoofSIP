import { createClient } from '@/app/_lib/supabase/server'
import { exchangeCodeForTokens } from '@/app/_lib/google'
import { encryptToken } from '@/app/_lib/token-crypto'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${origin}/settings?error=google`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)

  if (!state || state !== user.id) {
    return NextResponse.redirect(`${origin}/settings?error=google`)
  }

  const tokens = await exchangeCodeForTokens(code)
  if (!tokens.access_token) return NextResponse.redirect(`${origin}/settings?error=google`)

  await supabase
    .from('profiles')
    .update({
      google_access_token: encryptToken(tokens.access_token),
      google_refresh_token: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
      google_calendar_id: 'primary',
    })
    .eq('id', user.id)

  return NextResponse.redirect(`${origin}/settings?success=google`)
}
