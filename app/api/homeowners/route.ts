import { createClient, createServiceClient } from '@/app/_lib/supabase/server'
import { getTwilioClient } from '@/app/_lib/twilio'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, phone, address, zipCode, photoUrls } = body

  const service = await createServiceClient()

  const { data: homeowner, error } = await service
    .from('homeowners')
    .insert({
      roofer_id: user.id,
      name,
      phone,
      address,
      zip_code: zipCode,
      tcpa_consent: false,
      roof_photos: photoUrls ?? [],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { data: profile } = await service
    .from('profiles')
    .select('pm_name, company_name')
    .eq('id', user.id)
    .single()

  const firstName = name.split(' ')[0]
  const pmName = profile?.pm_name ?? 'Your contractor'
  const company = profile?.company_name ? ` from ${profile.company_name}` : ''

  const optInMsg = `Hi ${firstName}! ${pmName}${company} added you to receive free storm alerts for your roof. When storm activity hits your area, we'll send a heads up and offer a free inspection. Reply YES to opt in or STOP to skip.`

  try {
    const twilio = getTwilioClient()
    await twilio.messages.create({
      body: optInMsg,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: phone,
    })
    await service.from('sms_logs').insert({
      roofer_id: user.id,
      homeowner_id: homeowner.id,
      message: optInMsg,
      direction: 'outbound',
      status: 'sent',
    })
  } catch (err) {
    console.error('Opt-in SMS failed:', err)
  }

  return NextResponse.json({ id: homeowner.id })
}
