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
    const value = params.get('TriggerValue') ?? '50'

    await transporter.sendMail({
      from: `RoofSIP <${process.env.GMAIL_USER}>`,
      to: 'jbeatty1405@yahoo.com',
      subject: `🚨 RoofSIP Twilio spend hit $${value} — in-app SMS already blocked`,
      text: `Your Twilio account has hit $${value} this month.\n\nRoofSIP's in-app SMS cap (4,000 msgs/month) should have already blocked further sends. If you're still seeing charges, log in immediately:\nhttps://console.twilio.com\n\nTo raise the limit: update MONTHLY_SMS_CAP in app/_lib/twilio.ts and redeploy.`,
    })
  } catch (err) {
    console.error('[spending-kill] email failed:', err)
  }
  return new NextResponse('', { status: 200 })
}
