// Bulk-import step 1: parse a grid (from a CSV/Excel file or a pasted table)
// into normalized, validated review rows. NO database writes happen here — this
// only reads and returns what WOULD be imported so the PM can eyeball it first.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/_lib/supabase/server'
import { isSameOrigin } from '@/app/_lib/csrf'
import {
  inferColumnMapping, applyMapping, extractFreeform, reviewRow,
  MAX_IMPORT_ROWS, type RawRow, type ReviewRow,
} from '@/app/_lib/import-map'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const grid: unknown = body?.grid
  if (!Array.isArray(grid) || grid.length === 0) {
    return NextResponse.json({ error: 'Nothing to import' }, { status: 400 })
  }

  // Coerce to a clean string grid, cap rows and columns defensively.
  const clean: string[][] = (grid as unknown[])
    .slice(0, MAX_IMPORT_ROWS + 1)
    .filter(Array.isArray)
    .map((r) => (r as unknown[]).slice(0, 30).map((c) => (c == null ? '' : String(c))))
    .filter((r) => r.some((c) => c.trim() !== ''))

  if (clean.length === 0) return NextResponse.json({ error: 'Nothing to import' }, { status: 400 })

  const maxCols = clean.reduce((m, r) => Math.max(m, r.length), 0)

  let raws: RawRow[]
  try {
    if (maxCols >= 2) {
      const mapping = await inferColumnMapping(clean)
      raws = applyMapping(clean, mapping)
    } else {
      raws = await extractFreeform(clean.map((r) => r[0] ?? ''))
    }
  } catch (err) {
    console.error('[import/parse] mapping failed:', err)
    return NextResponse.json({ error: 'Could not read that list. Try a cleaner copy or a CSV/Excel file.' }, { status: 502 })
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
