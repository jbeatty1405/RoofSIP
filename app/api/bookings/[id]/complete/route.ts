import { createClient, createAdminClient } from '@/app/_lib/supabase/server'
import { getTwilioClient } from '@/app/_lib/twilio'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.email_confirmed_at) {
    return NextResponse.json({ error: 'Confirm your email first' }, { status: 403 })
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, homeowners(name, phone)')
    .eq('id', id)
    .eq('roofer_id', user.id)
    .single()

  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await supabase.from('bookings').update({ status: 'completed' }).eq('id', id)

  const { data: profile } = await supabase
    .from('profiles')
    .select('pm_name, company_name')
    .eq('id', user.id)
    .single()

  const homeowner = booking.homeowners
  const firstName = homeowner.name.split(' ')[0]
  const pmName = profile?.pm_name ?? 'your inspector'
  const company = profile?.company_name ? ` from ${profile.company_name}` : ''
  const msg = `Hi ${firstName}! Thanks for letting ${pmName}${company} inspect your roof today. If you have any questions or would like an estimate, feel free to reply here anytime.`

  try {
    const service = createAdminClient()
    const twilio = getTwilioClient()
    await twilio.messages.create({ body: msg, messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID!, to: homeowner.phone })
    const { error: logErr } = await service.from('sms_logs').insert({
      roofer_id: user.id,
      homeowner_id: booking.homeowner_id,
      message: msg,
      direction: 'outbound',
      status: 'sent',
    })
    // Same 42501 as the intro log. Lower stakes here (nothing re-sends off this
    // row) but a missing row still means the roofer's message history lies.
    if (logErr) {
      console.error('[bookings] thank-you SMS sent but NOT logged:', logErr)
    }
  } catch (err) {
    console.error('Thank-you SMS failed:', err)
  }

  return NextResponse.json({ ok: true })
}
