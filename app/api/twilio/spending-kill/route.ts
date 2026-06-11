import { NextRequest, NextResponse } from 'next/server'
import { validateRequest } from 'twilio'
import nodemailer from 'nodemailer'
import { createServiceClient } from '@/app/_lib/supabase/server'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
})

export async function POST(request: NextRequest) {
  const body = await request.text()
  const params = new URLSearchParams(body)
  const payload = Object.fromEntries(params.entries())

  const twilioSignature = request.headers.get('x-twilio-signature')
  if (!twilioSignature) return new NextResponse('Forbidden', { status: 403 })
  const host = request.headers.get('x-forwarded-host') || new URL(request.url).host
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  const url = `${proto}://${host}/api/twilio/spending-kill`
  const isValid = validateRequest(process.env.TWILIO_AUTH_TOKEN!, twilioSignature, url, payload)
  if (!isValid) return new NextResponse('Forbidden', { status: 403 })

  const value = payload.TriggerValue ?? '50'

  // Actually halt sends: set the persistent kill flag that isMonthlySmsCapped()
  // honors. This is the real stop — the email below is just the notification.
  try {
    const supabase = await createServiceClient()
    await supabase.from('app_flags').upsert(
      { flag: 'sms_send_kill', enabled: true, note: `Twilio spend hit $${value}`, updated_at: new Date().toISOString() },
      { onConflict: 'flag' },
    )
  } catch (err) {
    console.error('[spending-kill] failed to set kill flag:', err)
  }

  try {
    await transporter.sendMail({
      from: `RoofSIP <${process.env.GMAIL_USER}>`,
      to: 'jbeatty1405@yahoo.com',
      subject: `🚨 RoofSIP Twilio spend hit $${value} — automated SMS HALTED`,
      text: `Your Twilio account has hit $${value} this month.\n\nRoofSIP automated SMS is now HALTED: the sms_send_kill flag is set, so isMonthlySmsCapped() blocks all cron/intro sends until you clear it.\n\nTo resume sending once resolved, set app_flags.sms_send_kill enabled=false (Supabase) and confirm spend at https://console.twilio.com`,
    })
  } catch (err) {
    console.error('[spending-kill] email failed:', err)
  }
  return new NextResponse('', { status: 200 })
}
