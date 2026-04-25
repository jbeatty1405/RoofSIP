import { createClient } from '@/app/_lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, message } = await request.json()
  if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('pm_name, company_name')
    .eq('id', user.id)
    .single()

  const senderLabel = [profile?.pm_name, profile?.company_name].filter(Boolean).join(' · ') || user.email

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })

  await transporter.sendMail({
    from: `RoofSIP <${process.env.GMAIL_USER}>`,
    to: 'jbeatty1405@yahoo.com',
    subject: `[RoofSIP ${type}] from ${senderLabel}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 4px;font-size:18px;color:#111">New ${type} submitted</h2>
        <p style="margin:0 0 20px;color:#666;font-size:14px">From: <strong>${senderLabel}</strong> (${user.email})</p>
        <div style="background:#f4f4f5;border-radius:10px;padding:16px;margin-bottom:16px;font-size:14px;color:#333;white-space:pre-wrap">${message.trim()}</div>
        <p style="margin:0;font-size:12px;color:#999">User ID: ${user.id}</p>
      </div>
    `,
  })

  return NextResponse.json({ ok: true })
}
