import { createClient, createServiceClient } from '@/app/_lib/supabase/server'
import { getTwilioClient, buildIntroSms } from '@/app/_lib/twilio'
import { isQuietHours } from '@/app/_lib/schedule'
import { homeownerCreatesLast24h, HOMEOWNER_DAILY_LIMIT } from '@/app/_lib/rate-limit'
import { isSameOrigin } from '@/app/_lib/csrf'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const MAX_NAME = 120
const MAX_ADDRESS = 240
const MAX_ZIP = 10
const MAX_PHOTOS = 20
const MAX_PHOTO_URL = 500

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!user.email_confirmed_at) {
    return NextResponse.json({ error: 'Confirm your email before adding homeowners' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const validation = validateHomeowner(body as Record<string, unknown>)
  if ('error' in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }
  const { name, address, zipCode, photoUrls, phone, tcpaConsent, marketId, monitorOnly } = validation

  const recent = await homeownerCreatesLast24h(supabase, user.id)
  if (recent >= HOMEOWNER_DAILY_LIMIT) {
    return NextResponse.json(
      { error: `Daily limit reached (${HOMEOWNER_DAILY_LIMIT}/day). Try again tomorrow.` },
      { status: 429 },
    )
  }

  const { data: homeowner, error } = await supabase
    .from('homeowners')
    .insert({
      roofer_id: user.id,
      name,
      phone,
      address,
      zip_code: zipCode,
      market_id: marketId ?? null,
      monitor_only: monitorOnly,
      tcpa_consent: monitorOnly ? false : tcpaConsent,
      tcpa_consent_at: (!monitorOnly && tcpaConsent) ? new Date().toISOString() : null,
      roof_photos: photoUrls,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const service = await createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('pm_name, company_name')
    .eq('id', user.id)
    .single()

  if (monitorOnly || !tcpaConsent || isQuietHours()) {
    return NextResponse.json({ id: homeowner.id, deferred: (!monitorOnly && tcpaConsent && isQuietHours()) })
  }

  const pmName = profile?.pm_name ?? 'Your contractor'
  const introMsg = buildIntroSms(pmName, name, profile?.company_name ?? undefined)

  let smsError: string | null = null
  try {
    const twilio = getTwilioClient()
    await twilio.messages.create({
      body: introMsg,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: phone,
    })
    await service.from('sms_logs').insert({
      roofer_id: user.id,
      homeowner_id: homeowner.id,
      message: introMsg,
      direction: 'outbound',
      status: 'sent',
    })
  } catch (err) {
    smsError = err instanceof Error ? err.message : String(err)
    console.error('Intro SMS failed:', smsError)
  }

  return NextResponse.json({ id: homeowner.id, smsError })
}

type ValidHomeowner = {
  name: string
  address: string
  zipCode: string
  photoUrls: string[]
  phone: string
  tcpaConsent: boolean
  marketId: string | null
  monitorOnly: boolean
}

function validateHomeowner(body: Record<string, unknown>): ValidHomeowner | { error: string } {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const address = typeof body.address === 'string' ? body.address.trim() : ''
  const zipCode = typeof body.zipCode === 'string' ? body.zipCode.trim() : ''
  const rawPhone = typeof body.phone === 'string' ? body.phone : ''
  const tcpaConsent = body.tcpaConsent === true
  const marketId = typeof body.marketId === 'string' && body.marketId ? body.marketId : null

  if (!name) return { error: 'Name required' }
  if (name.length > MAX_NAME) return { error: 'Name too long' }
  if (!address) return { error: 'Address required' }
  if (address.length > MAX_ADDRESS) return { error: 'Address too long' }
  if (!/^\d{5}(-\d{4})?$/.test(zipCode)) return { error: 'Invalid ZIP code' }
  if (zipCode.length > MAX_ZIP) return { error: 'ZIP too long' }

  const phone = normalizePhone(rawPhone)
  if (!/^\+1\d{10}$/.test(phone)) return { error: 'Invalid phone number' }

  const photoUrlsRaw = Array.isArray(body.photoUrls) ? body.photoUrls : []
  if (photoUrlsRaw.length > MAX_PHOTOS) return { error: `Max ${MAX_PHOTOS} photos` }
  const photoUrls: string[] = []
  for (const u of photoUrlsRaw) {
    if (typeof u !== 'string') return { error: 'Invalid photo URL' }
    if (u.length > MAX_PHOTO_URL) return { error: 'Photo URL too long' }
    if (!/^https?:\/\//.test(u)) return { error: 'Photo URL must be http(s)' }
    photoUrls.push(u)
  }

  const monitorOnly = body.monitorOnly === true

  return { name, address, zipCode, photoUrls, phone, tcpaConsent, marketId, monitorOnly }
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return raw
}
