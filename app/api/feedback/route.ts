import { createClient } from '@/app/_lib/supabase/server'
import { isSameOrigin } from '@/app/_lib/csrf'
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export const dynamic = 'force-dynamic'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const rawMessage = String(body.message ?? '').trim()
  const rawType = String(body.type ?? '').trim()

  if (!rawMessage) return NextResponse.json({ error: 'Message required' }, { status: 400 })
  if (rawMessage.length > 2000) return NextResponse.json({ error: 'Message too long' }, { status: 400 })
  if (rawType.length > 50) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

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

  const safeMessage = escapeHtml(rawMessage)
  const safeSender = escapeHtml(senderLabel ?? '')
  const safeType = escapeHtml(rawType)
  const safeEmail = escapeHtml(user.email ?? '')
  const safeId = escapeHtml(user.id)

  await transporter.sendMail({
    from: `RoofSIP <${process.env.GMAIL_USER}>`,
    to: 'jbeatty1405@yahoo.com',
    subject: `[RoofSIP ${safeType}] from ${safeSender}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 4px;font-size:18px;color:#111">New ${safeType} submitted</h2>
        <p style="margin:0 0 20px;color:#666;font-size:14px">From: <strong>${safeSender}</strong> (${safeEmail})</p>
        <div style="background:#f4f4f5;border-radius:10px;padding:16px;margin-bottom:16px;font-size:14px;color:#333;white-space:pre-wrap">${safeMessage}</div>
        <p style="margin:0;font-size:12px;color:#999">User ID: ${safeId}</p>
      </div>
    `,
  })

  return NextResponse.json({ ok: true })
}
