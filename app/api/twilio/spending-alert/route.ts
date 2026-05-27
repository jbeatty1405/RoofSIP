import { NextRequest, NextResponse } from 'next/server'
import { validateRequest } from 'twilio'
import nodemailer from 'nodemailer'

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
  const url = `${proto}://${host}/api/twilio/spending-alert`
  const isValid = validateRequest(process.env.TWILIO_AUTH_TOKEN!, twilioSignature, url, payload)
  if (!isValid) return new NextResponse('Forbidden', { status: 403 })

  try {
    const value = payload.TriggerValue ?? '40'
    const category = payload.UsageCategory ?? 'totalprice'
    await transporter.sendMail({
      from: `RoofSIP <${process.env.GMAIL_USER}>`,
      to: 'jbeatty1405@yahoo.com',
      subject: `⚠️ RoofSIP Twilio spend hit $${value} this month`,
      text: `Your Twilio account has reached $${value} in spend this month (category: ${category}).\n\nThis is the $40 warning — SMS will auto-stop at $50 in-app. Log in to https://console.twilio.com to review usage.`,
    })
  } catch (err) {
    console.error('[spending-alert] email failed:', err)
  }
  return new NextResponse('', { status: 200 })
}
