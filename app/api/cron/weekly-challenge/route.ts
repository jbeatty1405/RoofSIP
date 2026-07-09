import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/app/_lib/supabase/server'
import { sendExpoPush, type ExpoPushMessage } from '@/app/_lib/push'

// Weekly "add 5 roofs" challenge push.
//
// A GitHub Actions workflow (.github/workflows/weekly-challenge.yml) hits this
// Monday morning AZ time. It nudges every PM with a push token to load more
// roofs, segmented by how many they're already watching.
//
// TWO independent safety gates, both must be green to actually send:
//   1. WEEKLY_CHALLENGE_ENABLED=true  — this feature's own switch (default off).
//      Storm-lead push (PUSH_ENABLED) is a SEPARATE channel; turning storms on
//      must never fire this weekly blast, so it has its own flag.
//   2. PUSH_ENABLED=true              — the global push channel gate in push.ts.
//
// While WEEKLY_CHALLENGE_ENABLED is off this endpoint is a DRY RUN: it computes
// the exact recipient list + segment breakdown and returns it WITHOUT sending,
// so the first real send is a deliberate, previewed go-live.

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()

  // Every PM who has a device registered for push.
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, pm_name, push_token')
    .not('push_token', 'is', null)

  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 500 })
  }
  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ recipients: 0, reason: 'no push tokens' })
  }

  // Count each PM's watched roofs in one pass (exclude test rows).
  const pmIds = profiles.map((p) => p.id)
  const { data: hos } = await supabase
    .from('homeowners')
    .select('roofer_id')
    .in('roofer_id', pmIds)
    .neq('is_test', true)

  const counts = new Map<string, number>()
  for (const h of hos ?? []) {
    counts.set(h.roofer_id, (counts.get(h.roofer_id) ?? 0) + 1)
  }

  const messages: ExpoPushMessage[] = []
  let emptySip = 0
  let active = 0

  for (const p of profiles) {
    const count = counts.get(p.id) ?? 0
    if (count === 0) {
      emptySip++
      messages.push({
        to: p.push_token as string,
        title: 'Your SIP is empty',
        body: 'Load 5 roofs from your notepad as monitor-only and SIP starts watching them for storms today. Two minutes to start.',
        data: { type: 'weekly_challenge', screen: 'how-it-works' },
      })
    } else {
      active++
      messages.push({
        to: p.push_token as string,
        title: 'Monday challenge: add 5 roofs',
        body: `You're watching ${count}. Dump 5 more from your notepad in. Every roof you watch is one more storm that pays you back.`,
        data: { type: 'weekly_challenge', screen: 'homeowners-new' },
      })
    }
  }

  const summary = { recipients: messages.length, emptySip, active }

  // GATE 1: default dry run. Compute and preview, never send.
  if (process.env.WEEKLY_CHALLENGE_ENABLED !== 'true') {
    return NextResponse.json({
      paused: true,
      reason: 'WEEKLY_CHALLENGE_ENABLED is not true — dry run, nothing sent',
      wouldSend: summary,
      sample: messages.slice(0, 3).map((m) => ({ title: m.title, body: m.body })),
    })
  }

  // Live send (still additionally gated by PUSH_ENABLED inside sendExpoPush).
  await sendExpoPush(messages)
  return NextResponse.json({ sent: summary })
}
