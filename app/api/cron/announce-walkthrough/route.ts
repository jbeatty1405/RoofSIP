// One-time broadcast: tell active subscribers about the in-app walk-through.
//
// Pushes to every ACTIVE subscriber with a device token. The push carries
// data.screen = 'how-it-works', so tapping it opens the walk-through (the
// mobile app wires this deep-link in app/_layout.tsx).
//
// SAFETY: dry run by default. It only sends when called with ?send=1 (a
// deliberate, previewed trigger via the GitHub "Announce walk-through" workflow),
// and sendExpoPush is still additionally gated by PUSH_ENABLED. With no ?send it
// returns the exact recipient count + a sample and sends nothing.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/app/_lib/supabase/server'
import { sendExpoPush, type ExpoPushMessage } from '@/app/_lib/push'

const TITLE = 'See everything SIP does for you'
const BODY = 'New walk-through inside — how SIP texts your homeowners, books the inspection, and turns old leads into hot ones. Takes 2 minutes.'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, push_token')
    .eq('subscription_status', 'active')
    .not('push_token', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const messages: ExpoPushMessage[] = (profiles ?? []).map((p) => ({
    to: p.push_token as string,
    title: TITLE,
    body: BODY,
    data: { type: 'walkthrough', screen: 'how-it-works' },
  }))

  const doSend = new URL(request.url).searchParams.get('send') === '1'

  if (!doSend) {
    return NextResponse.json({
      paused: true,
      reason: 'dry run — add ?send=1 to actually send',
      wouldSend: messages.length,
      sample: { title: TITLE, body: BODY },
    })
  }

  await sendExpoPush(messages)
  return NextResponse.json({ sent: messages.length })
}
