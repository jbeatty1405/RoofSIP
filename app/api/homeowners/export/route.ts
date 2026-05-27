import { createClient, createServiceClient } from '@/app/_lib/supabase/server'
import { checkRateLimit } from '@/app/_lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function csvSafe(s: string): string {
  const escaped = s.replace(/"/g, '""')
  return /^[=+\-@\t\r]/.test(escaped) ? `"'${escaped}"` : `"${escaped}"`
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const service = await createServiceClient()
  const allowed = await checkRateLimit(service, user.id, 'export', 10, 3600 * 1000)
  if (!allowed) return new NextResponse('Export rate limit reached. Try again in an hour.', { status: 429 })

  const { data: logs } = await supabase
    .from('sms_logs')
    .select('*, homeowners(name, phone, address)')
    .eq('roofer_id', user.id)
    .order('sent_at', { ascending: false })
    .limit(5000)

  const rows = [
    ['Date', 'Homeowner', 'Phone', 'Address', 'Direction', 'Message'].join(','),
    ...(logs ?? []).map((l: any) => [
      new Date(l.sent_at).toLocaleString(),
      csvSafe(l.homeowners?.name ?? ''),
      csvSafe(l.homeowners?.phone ?? ''),
      csvSafe(l.homeowners?.address ?? ''),
      csvSafe(l.direction ?? ''),
      csvSafe(l.message ?? ''),
    ].join(',')),
  ]

  return new NextResponse(rows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="roofsip-sms-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
