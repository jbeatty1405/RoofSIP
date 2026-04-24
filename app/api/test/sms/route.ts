import { createServiceClient } from '@/app/_lib/supabase/server'
import { getTwilioClient } from '@/app/_lib/twilio'
import { generateStormSms } from '@/app/_lib/ai-sms'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const twilio = getTwilioClient()

  const { data: homeowners } = await supabase
    .from('homeowners')
    .select('*, profiles(id, pm_name, company_name, message_style)')
    .eq('tcpa_consent', true)

  if (!homeowners?.length) return NextResponse.json({ sent: 0, message: 'No homeowners with consent' })

  let totalSent = 0

  for (const homeowner of homeowners as any[]) {
    const profile = homeowner.profiles
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
      message = `Hi ${firstName}, this is ${profile?.pm_name} from ${profile?.company_name ?? 'our roofing team'}. We're seeing storm activity near your home. Reply YES for a free roof inspection.`
    }

    try {
      await twilio.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: homeowner.phone,
      })

      await supabase.from('sms_logs').insert({
        roofer_id: homeowner.roofer_id,
        homeowner_id: homeowner.id,
        message,
        direction: 'outbound',
        status: 'sent',
      })

      totalSent++
    } catch (err) {
      console.error(`SMS failed to ${homeowner.phone}:`, err)
    }
  }

  return NextResponse.json({ sent: totalSent })
}
