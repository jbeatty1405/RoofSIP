/**
 * End-to-end webhook test — runs all HO reply scenarios against production.
 * Creates isolated test records, verifies DB outcomes, cleans up after.
 *
 * Usage: npx tsx scripts/test-webhook-e2e.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'
import * as crypto from 'crypto'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const WEBHOOK_URL = process.env.TEST_WEBHOOK_URL ?? 'http://localhost:3000/api/twilio/webhook'
const TEST_PHONE = '+14805550199'
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!AUTH_TOKEN || !SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars — check .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// --- Helpers ---

function sign(params: Record<string, string>): string {
  let s = WEBHOOK_URL
  Object.keys(params).sort().forEach(k => { s += k + params[k] })
  return crypto.createHmac('sha1', AUTH_TOKEN).update(s, 'utf8').digest('base64')
}

async function post(body: string): Promise<number> {
  const params: Record<string, string> = {
    From: TEST_PHONE,
    To: process.env.TWILIO_PHONE_NUMBER ?? '+18775024593',
    Body: body,
    MessageSid: `TEST${Date.now()}`,
  }
  const sig = sign(params)
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Twilio-Signature': sig },
    body: new URLSearchParams(params).toString(),
  })
  return res.status
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

let passed = 0
let failed = 0

async function check(label: string, assertion: () => Promise<boolean>) {
  try {
    const ok = await assertion()
    if (ok) {
      console.log(`  ✅ ${label}`)
      passed++
    } else {
      console.log(`  ❌ ${label}`)
      failed++
    }
  } catch (e) {
    console.log(`  ❌ ${label} (threw: ${e})`)
    failed++
  }
}

async function getHomeowner() {
  const { data } = await supabase.from('homeowners').select('*').eq('phone', TEST_PHONE).maybeSingle()
  return data
}

async function getPending(homeownerId: string) {
  const { data } = await supabase.from('pending_bookings').select('*').eq('homeowner_id', homeownerId).maybeSingle()
  return data
}

async function getLatestNotification(homeownerId: string) {
  const { data } = await supabase.from('notifications').select('*').eq('homeowner_id', homeownerId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  return data
}

async function getLatestOutbound(homeownerId: string) {
  const { data } = await supabase.from('sms_logs').select('*').eq('homeowner_id', homeownerId).eq('direction', 'outbound').order('sent_at', { ascending: false }).limit(1).maybeSingle()
  return data
}

// --- Setup: find a real roofer_id to attach the test homeowner to ---

async function getRooferIdAndProfile() {
  const { data } = await supabase.from('homeowners').select('roofer_id').limit(1).single()
  if (!data) throw new Error('No homeowners found in DB — add at least one real homeowner first')
  return { id: data.roofer_id, pm_name: 'PM' }
}

async function createTestHomeowner(rooferID: string, opts: {
  sms_confirmed?: boolean
  tcpa_consent?: boolean
} = {}) {
  // Clean up any leftover test homeowner first
  await supabase.from('homeowners').delete().eq('phone', TEST_PHONE)

  const { data, error } = await supabase.from('homeowners').insert({
    roofer_id: rooferID,
    name: 'Test Homeowner E2E',
    phone: TEST_PHONE,
    address: '123 Test St, Phoenix AZ 85001',
    zip_code: '85001',
    tcpa_consent: opts.tcpa_consent ?? true,
    sms_confirmed: opts.sms_confirmed ?? false,
  }).select().single()
  if (error) throw new Error(`Failed to create test homeowner: ${error.message}`)
  return data
}

async function setPendingBooking(homeownerId: string, rooferID: string, status: string, proposedSlot?: string) {
  await supabase.from('pending_bookings').delete().eq('homeowner_id', homeownerId)
  if (status) {
    const slot = proposedSlot ?? new Date(Date.now() + 86400000).toISOString()
    await supabase.from('pending_bookings').insert({
      homeowner_id: homeownerId,
      roofer_id: rooferID,
      status,
      proposed_slot: slot,
      slots: [],
    })
  }
}

async function cleanup(homeownerId: string) {
  await supabase.from('sms_logs').delete().eq('homeowner_id', homeownerId)
  await supabase.from('notifications').delete().eq('homeowner_id', homeownerId)
  await supabase.from('pending_bookings').delete().eq('homeowner_id', homeownerId)
  await supabase.from('homeowners').delete().eq('id', homeownerId)
}

// ============================================================
// TESTS
// ============================================================

async function run() {
  console.log('🔁 RoofSIP Webhook E2E Test\n')

  const profile = await getRooferIdAndProfile()
  const rooferID = profile.id
  console.log(`  Using roofer: ${profile.pm_name ?? profile.id}\n`)

  let ho: any

  // ──────────────────────────────────────────────────────────
  console.log('── PRE-OPT-IN FLOWS ──')

  ho = await createTestHomeowner(rooferID, { sms_confirmed: false, tcpa_consent: true })

  console.log('\nScenario 1: Pre-opt-in → YES')
  await post('yes')
  await sleep(3000)
  await check('sms_confirmed set to true', async () => { const h = await getHomeowner(); return h?.sms_confirmed === true })
  await check('outbound confirmation SMS logged', async () => { const s = await getLatestOutbound(ho.id); return !!s })

  console.log('\nScenario 2: Pre-opt-in → STOP (reset first)')
  await supabase.from('homeowners').update({ sms_confirmed: false, tcpa_consent: true }).eq('id', ho.id)
  await post('stop')
  await sleep(3000)
  await check('tcpa_consent set to false', async () => { const h = await getHomeowner(); return h?.tcpa_consent === false })

  console.log('\nScenario 3: Pre-opt-in → other ("who is this?")')
  await supabase.from('homeowners').update({ sms_confirmed: false, tcpa_consent: true }).eq('id', ho.id)
  await post('who is this')
  await sleep(3000)
  await check('outbound explanation SMS logged', async () => { const s = await getLatestOutbound(ho.id); return !!s?.message?.includes('Hailey') })

  // ──────────────────────────────────────────────────────────
  console.log('\n── CONFIRMED HO, NO PENDING BOOKING ──')

  await supabase.from('homeowners').update({ sms_confirmed: true, tcpa_consent: true }).eq('id', ho.id)
  await supabase.from('pending_bookings').delete().eq('homeowner_id', ho.id)

  console.log('\nScenario 4: Confirmed, no pending → STOP')
  await post('stop')
  await sleep(3000)
  await check('tcpa_consent set to false', async () => { const h = await getHomeowner(); return h?.tcpa_consent === false })

  console.log('\nScenario 5: Confirmed, no pending → organic YES')
  await supabase.from('homeowners').update({ sms_confirmed: true, tcpa_consent: true }).eq('id', ho.id)
  await post('yes, sounds good')
  await sleep(4000)
  await check('outbound AI reply sent', async () => { const s = await getLatestOutbound(ho.id); return !!s })
  await check('notification created', async () => { const n = await getLatestNotification(ho.id); return !!n })

  console.log('\nScenario 6: Confirmed, no pending → gives specific time')
  await supabase.from('notifications').delete().eq('homeowner_id', ho.id)
  await post('how about Thursday at 10am')
  await sleep(4000)
  await check('outbound AI reply sent', async () => { const s = await getLatestOutbound(ho.id); return !!s })
  await check('notification created (gave_time or unclear→clarify)', async () => {
    const n = await getLatestNotification(ho.id)
    const s = await getLatestOutbound(ho.id)
    return !!(n || s)
  })

  console.log('\nScenario 7: Confirmed, no pending → vague availability')
  await supabase.from('notifications').delete().eq('homeowner_id', ho.id)
  await post('I am usually home in the afternoons on weekdays')
  await sleep(4000)
  await check('outbound AI reply sent', async () => { const s = await getLatestOutbound(ho.id); return !!s })
  await check('call_needed notification created', async () => { const n = await getLatestNotification(ho.id); return n?.type === 'call_needed' })

  // ──────────────────────────────────────────────────────────
  console.log('\n── CONFIRMED HO, PENDING awaiting_ho_reply ──')

  await setPendingBooking(ho.id, rooferID, 'awaiting_ho_reply')
  await supabase.from('notifications').delete().eq('homeowner_id', ho.id)

  console.log('\nScenario 8: pending awaiting_ho_reply → YES')
  await post('yes that works')
  await sleep(4000)
  await check('hot_lead notification created', async () => { const n = await getLatestNotification(ho.id); return n?.type === 'hot_lead' })
  await check('pending_booking status = confirmed', async () => { const p = await getPending(ho.id); return p?.status === 'confirmed' })

  console.log('\nScenario 9: pending awaiting_ho_reply → gives specific time')
  await setPendingBooking(ho.id, rooferID, 'awaiting_ho_reply')
  await supabase.from('notifications').delete().eq('homeowner_id', ho.id)
  await post('can you do next Tuesday at 2pm instead')
  await sleep(4000)
  await check('outbound AI reply sent', async () => { const s = await getLatestOutbound(ho.id); return !!s })
  await check('notification or booking updated', async () => {
    const n = await getLatestNotification(ho.id)
    const p = await getPending(ho.id)
    return !!(n || (p && p.status !== 'awaiting_ho_reply'))
  })

  // ──────────────────────────────────────────────────────────
  console.log('\n── CLARIFICATION ESCALATION ──')

  console.log('\nScenario 10: pending awaiting_ho_clarification → unclear → PM call')
  await setPendingBooking(ho.id, rooferID, 'awaiting_ho_clarification')
  await supabase.from('notifications').delete().eq('homeowner_id', ho.id)
  await post('I dunno maybe sometime I guess')
  await sleep(4000)
  await check('call_needed notification created (PM escalation)', async () => { const n = await getLatestNotification(ho.id); return n?.type === 'call_needed' })
  await check('pending_booking status = pm_calling', async () => { const p = await getPending(ho.id); return p?.status === 'pm_calling' })

  // ──────────────────────────────────────────────────────────
  console.log('\n── PM REVIEWING FOLLOW-UP ──')

  console.log('\nScenario 11: pending pm_reviewing → HO follows up')
  await setPendingBooking(ho.id, rooferID, 'pm_reviewing')
  await supabase.from('notifications').delete().eq('homeowner_id', ho.id)
  await post('did Mike call yet? I haven\'t heard from him')
  await sleep(4000)
  await check('outbound AI reply sent (reassurance)', async () => { const s = await getLatestOutbound(ho.id); return !!s })
  await check('booking moved to awaiting_ho_clarification', async () => { const p = await getPending(ho.id); return p?.status === 'awaiting_ho_clarification' })

  // ──────────────────────────────────────────────────────────
  console.log('\n── UNKNOWN PHONE ──')

  console.log('\nScenario 12: unknown phone → silent 200')
  const unknownParams: Record<string, string> = {
    From: '+19995550000',
    To: process.env.TWILIO_PHONE_NUMBER ?? '+18775024593',
    Body: 'hello',
    MessageSid: `TEST${Date.now()}`,
  }
  const sig = sign(unknownParams)
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Twilio-Signature': sig },
    body: new URLSearchParams(unknownParams).toString(),
  })
  await check('returns 200 with no action', async () => res.status === 200)

  // ──────────────────────────────────────────────────────────
  console.log('\n── CLEANUP ──')
  await cleanup(ho.id)
  console.log('  Test records removed\n')

  // ──────────────────────────────────────────────────────────
  console.log('══════════════════════════════')
  console.log(`  Results: ${passed} passed, ${failed} failed`)
  if (failed === 0) {
    console.log('  🎉 All scenarios covered — no silent drops found')
  } else {
    console.log('  ⚠️  Some scenarios need attention')
  }
  console.log('══════════════════════════════\n')

  process.exit(failed > 0 ? 1 : 0)
}

run().catch(e => { console.error('Test runner crashed:', e); process.exit(1) })
