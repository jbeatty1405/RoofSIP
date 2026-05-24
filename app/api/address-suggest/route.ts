import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type Suggestion = {
  address: string
  zipCode: string
}

export async function GET(request: NextRequest) {
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
