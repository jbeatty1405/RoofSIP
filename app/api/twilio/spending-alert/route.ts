import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const params = new URLSearchParams(body)
    const category = params.get('UsageCategory') ?? 'totalprice'
    const value = params.get('TriggerValue') ?? '40'

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
