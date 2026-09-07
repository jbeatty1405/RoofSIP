import { createClient } from '@/app/_lib/supabase/server'
import { isSameOrigin } from '@/app/_lib/csrf'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type Suggestion = {
  address: string
  zipCode: string
}

export async function GET(request: NextRequest) {
  // Every call to Nominatim goes out under RoofSIP's User-Agent, so leaving this
  // open meant anyone could get that UA rate-limited or banned and take the
  // address box down for real users. The only caller is the new-homeowner form
  // in (dashboard), which is already behind login — so requiring a session costs
  // nothing and closes it outright rather than merely slowing it down.
  //
  // Failures answer with an empty array, not an error object: the caller does
  // `data.length` on whatever comes back, and an object there breaks the dropdown.
  if (!isSameOrigin(request)) return NextResponse.json([], { status: 403 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 4) return NextResponse.json([])

  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(q)}&countrycodes=us&addressdetails=1&format=json&limit=6`

  let raw: any[]
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'RoofSIP/1.0 (azroofsip@gmail.com)' },
      next: { revalidate: 300 },
    })
    if (!res.ok) return NextResponse.json([])
    raw = await res.json()
  } catch {
    return NextResponse.json([])
  }

  const suggestions: Suggestion[] = raw
    .filter((r: any) => r.address?.house_number && r.address?.road)
    .map((r: any) => {
      const { house_number, road, city, town, village, county, postcode, state } = r.address
      const locality = city || town || village || county || ''
      const street = [house_number, road].filter(Boolean).join(' ')
      const address = [street, locality, state].filter(Boolean).join(', ')
      return { address, zipCode: (postcode ?? '').slice(0, 5) }
    })
    .filter((s: Suggestion) => s.address && /^\d{5}$/.test(s.zipCode))

  return NextResponse.json(suggestions)
}
