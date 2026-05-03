import { createClient, createServiceClient } from '@/app/_lib/supabase/server'
import { getTwilioClient } from '@/app/_lib/twilio'
import { generateStormSms } from '@/app/_lib/ai-sms'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const MAX_TEST_RECIPIENTS = 3

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.email_confirmed_at) {
    return NextResponse.json({ error: 'Confirm your email first' }, { status: 403 })
  }

  const service = await createServiceClient()
  const twilio = getTwilioClient()

  const { data: homeowners } = await supabase
    .from('homeowners')
    .select('*')
    .eq('roofer_id', user.id)
    .eq('tcpa_consent', true)
    .limit(MAX_TEST_RECIPIENTS)

  if (!homeowners?.length) {
    return NextResponse.json({ sent: 0, message: 'No consented homeowners on your account' })
  }

  const { data: profile } = await service
    .from('profiles')
    .select('pm_name, company_name, message_style')
    .eq('id', user.id)
    .single()

  let totalSent = 0

  for (const homeowner of homeowners) {
    const firstName = homeowner.name.split(' ')[0]

    let message: string
    try {
      message = await generateStormSms({
        firstName,
        pmName: profile?.pm_name ?? '',
        companyName: profile?.company_name ?? '',
        stormType: 'Severe Thunderstorm',
        zipCode: homeowner.zip_code,
        messageStyle: profile?.message_style ?? 'Friendly and casual, like a neighbor giving a heads up.',
      })
    } catch {
      message = `Hi ${firstName}, this is ${profile?.pm_name ?? 'your contractor'} from ${profile?.company_name ?? 'our roofing team'}. We're seeing storm activity near your home. Reply YES for a free roof inspection.`
    }

    try {
      await twilio.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: homeowner.phone,
      })

      await service.from('sms_logs').insert({
        roofer_id: user.id,
        homeowner_id: homeowner.id,
        message,
        direction: 'outbound',
        status: 'sent',
      })

      totalSent++
    } catch (err) {
      console.error(`Test SMS failed to ${homeowner.phone}:`, err)
    }
  }

  return NextResponse.json({ sent: totalSent })
}
