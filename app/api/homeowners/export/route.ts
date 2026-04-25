import { createClient } from '@/app/_lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: logs } = await supabase
    .from('sms_logs')
    .select('*, homeowners(name, phone, address)')
    .eq('roofer_id', user.id)
    .order('created_at', { ascending: false })

  const rows = [
    ['Date', 'Homeowner', 'Phone', 'Address', 'Direction', 'Message'].join(','),
    ...(logs ?? []).map((l: any) => [
      new Date(l.created_at).toLocaleString(),
      `"${(l.homeowners?.name ?? '').replace(/"/g, '""')}"`,
      l.homeowners?.phone ?? '',
      `"${(l.homeowners?.address ?? '').replace(/"/g, '""')}"`,
      l.direction,
      `"${(l.message ?? '').replace(/"/g, '""')}"`,
    ].join(',')),
  ]

  return new NextResponse(rows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="roofsip-sms-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
