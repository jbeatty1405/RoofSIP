// Bulk-import step 2: insert the reviewed rows. Everything lands as
// monitor_only=true — SIP watches these addresses and surfaces storm hits as
// Hot Leads, but NEVER texts them. That's the whole safety story: a bulk import
// can't blast opt-in SMS to hundreds of people, so it's cost- and TCPA-safe.

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/app/_lib/supabase/server'
import { isSameOrigin } from '@/app/_lib/csrf'
import { ADMIN_USER_ID } from '@/app/_lib/admin'
import { reviewRow, MAX_IMPORT_ROWS, type RawRow } from '@/app/_lib/import-map'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const rawRows: unknown = body?.rows
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return NextResponse.json({ error: 'Nothing to import' }, { status: 400 })
  }

  // Admins may import on behalf of another roofer; everyone else imports to self.
  const isAdmin = user.id === ADMIN_USER_ID
  const targetRooferId =
    isAdmin && typeof body?.targetRooferId === 'string' && body.targetRooferId
      ? body.targetRooferId
      : user.id

  // Re-validate every row here — the client's "ok" flag is never trusted.
  const valid = (rawRows as RawRow[])
    .slice(0, MAX_IMPORT_ROWS)
    .map(reviewRow)
    .filter((r) => r.ok)
    .map((r) => r.row)

  const skippedInvalid = Math.min(rawRows.length, MAX_IMPORT_ROWS) - valid.length

  // Dedupe within the batch by phone.
  const seen = new Set<string>()
  const deduped = valid.filter((r) => (seen.has(r.phone) ? false : (seen.add(r.phone), true)))

  const service = await createServiceClient()

  // Skip phones already on this roofer's account (the table has a unique
  // constraint on phone per roofer, so this avoids a whole-batch failure).
  const { data: existing } = await service
    .from('homeowners')
    .select('phone')
    .eq('roofer_id', targetRooferId)
    .in('phone', deduped.map((r) => r.phone))
  const existingPhones = new Set((existing ?? []).map((e: { phone: string }) => e.phone))

  const toInsert = deduped.filter((r) => !existingPhones.has(r.phone))
  const skippedDupes = deduped.length - toInsert.length + (valid.length - deduped.length)

  let inserted = 0
  const CHUNK = 500
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK).map((r) => ({
      roofer_id: targetRooferId,
      name: r.name,
      phone: r.phone,
      address: r.address,
      zip_code: r.zip,
      market_id: null,
      monitor_only: true,
      tcpa_consent: false,
      tcpa_consent_at: null,
      roof_photos: [],
    }))
    const { data, error } = await service.from('homeowners').insert(chunk).select('id')
    if (error) {
      console.error('[import/commit] insert error:', error.message)
      return NextResponse.json(
        { error: 'Some rows failed to save. Nothing partial was reported.', inserted, detail: error.message },
        { status: 500 },
      )
    }
    inserted += data?.length ?? 0
  }

  return NextResponse.json({ inserted, skippedInvalid, skippedDupes, monitorOnly: true })
}
