// Bulk-import (image path): read a photo or screenshot into normalized, validated
// review rows via Claude vision. NO database writes — mirrors parse/route.ts, just
// takes an image instead of a grid. The client downsizes + re-encodes to JPEG
// before posting (handles HEIC and keeps the payload small).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/_lib/supabase/server'
import { isSameOrigin } from '@/app/_lib/csrf'
import { extractFromImage, reviewRow, MAX_IMPORT_ROWS, type ReviewRow } from '@/app/_lib/import-map'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
// base64 is ~1.33x the raw bytes; ~8M chars ≈ 6MB image, comfortably under limits.
const MAX_B64_LEN = 8_000_000

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const image = typeof body?.image === 'string' ? body.image : ''
  const mediaType = typeof body?.mediaType === 'string' ? body.mediaType : ''

  if (!image) return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  if (!ALLOWED.has(mediaType)) return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 })
  if (image.length > MAX_B64_LEN) {
    return NextResponse.json({ error: 'Image too large — try a screenshot or a smaller photo.' }, { status: 413 })
  }

  let raws
  try {
    raws = await extractFromImage(image, mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif')
  } catch (err) {
    console.error('[import/parse-image] extract failed:', err)
    return NextResponse.json({ error: 'Could not read that image. Try a clearer photo or a screenshot.' }, { status: 502 })
  }

  const reviewed: ReviewRow[] = raws.slice(0, MAX_IMPORT_ROWS).map(reviewRow)
  const okCount = reviewed.filter((r) => r.ok).length

  return NextResponse.json({
    rows: reviewed,
    total: reviewed.length,
    ok: okCount,
    needsFix: reviewed.length - okCount,
  })
}
