import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { buildInspectionIcs } from '@/app/_lib/ics'

// Serves a downloadable .ics for a confirmed booking so the roofer can tap
// "Add to Calendar" from the confirmation email. Unauthenticated by design
// (must work straight from a mail client), but keyed on an unguessable booking UUID.
export async function GET(req: NextRequest) {
  const bookingId = req.nextUrl.searchParams.get('booking')
  if (!bookingId) return new Response('Missing booking id', { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\s/g, ''),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.replace(/\s/g, '')
  )

  const { data: booking } = await supabase
    .from('pending_bookings')
    .select('proposed_slot, homeowners(name, address, phone)')
    .eq('id', bookingId)
    .maybeSingle()

  // Supabase types embedded relations as an array; at runtime a many-to-one is an object.
  const hoRaw = booking?.homeowners as unknown
  const ho = (Array.isArray(hoRaw) ? hoRaw[0] : hoRaw) as
    | { name: string; address: string; phone: string }
    | null
    | undefined
  if (!booking?.proposed_slot || !ho) {
    return new Response('Appointment not found', { status: 404 })
  }

  const ics = buildInspectionIcs({
    startISO: new Date(booking.proposed_slot).toISOString(),
    homeownerName: ho.name,
    homeownerAddress: ho.address,
    homeownerPhone: ho.phone,
  })
  if (!ics) return new Response('Invalid appointment time', { status: 404 })

  // inline (not attachment) so iOS Safari opens the "Add to Calendar" sheet
  // directly instead of saving the file to Files.
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="roof-inspection.ics"',
      'Cache-Control': 'no-store',
    },
  })
}
