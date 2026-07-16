export type WeatherAlert = {
  id: string
  type: string
  headline: string
  description: string
  severity: string
}

// A null return here means "we do not know where this ZIP is", and every caller
// downstream turns that into "no alerts" -> the storm is silently missed. So try
// a second, independent provider before giving up, and make the failure loud.
async function geocodeViaNominatim(zip: string): Promise<{ lat: string; lon: string } | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?postalcode=${zip}&country=US&format=json&limit=1`,
    { headers: { 'User-Agent': 'RoofSIP/1.0 (jbeatty1405@yahoo.com)' } }
  )
  if (!res.ok) throw new Error(`nominatim HTTP ${res.status}`)
  const data = await res.json()
  if (!data.length) return null
  return { lat: data[0].lat, lon: data[0].lon }
}

// US Census geocoder: free, no key, no rate-limit policy to violate. Used as the
// fallback when Nominatim throttles or blocks the hourly burst.
async function geocodeViaCensus(zip: string): Promise<{ lat: string; lon: string } | null> {
  const res = await fetch(
    `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${zip}&benchmark=Public_AR_Current&format=json`,
  )
  if (!res.ok) throw new Error(`census HTTP ${res.status}`)
  const data = await res.json()
  const match = data?.result?.addressMatches?.[0]?.coordinates
  if (!match) return null
  return { lat: String(match.y), lon: String(match.x) }
}

export async function geocodeZip(zip: string): Promise<{ lat: string; lon: string } | null> {
  for (const [name, fn] of [['nominatim', geocodeViaNominatim], ['census', geocodeViaCensus]] as const) {
    try {
      const point = await fn(zip)
      if (point) return point
      console.error(`[geocode] ${name} returned no match for ${zip}`)
    } catch (err) {
      console.error(`[geocode] ${name} failed for ${zip}:`, err)
    }
  }
  return null
}

export async function getAlertsForPoint(lat: string, lon: string): Promise<WeatherAlert[]> {
  try {
    const res = await fetch(
      `https://api.weather.gov/alerts/active?point=${parseFloat(lat).toFixed(4)},${parseFloat(lon).toFixed(4)}`,
      { headers: { 'User-Agent': 'RoofSIP/1.0 (jbeatty1405@yahoo.com)', Accept: 'application/geo+json' } }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.features ?? [])
      .filter((f: any) => {
        const event = (f.properties?.event ?? '').toLowerCase()
        const severity = (f.properties?.severity ?? '').toLowerCase()
        // Temperature alerts (Wind Chill, Excessive Heat, Hard Freeze, Frost,
        // Extreme Cold) match 'wind'/severity but mean nothing for roofs. Drop them.
        // Only trigger on things that actually damage a roof. We deliberately do
        // NOT pass on severity alone: NWS tags Flood Watches / Flash Flood
        // Warnings as "Severe", and flooding does nothing to a roof. That
        // severity catch-all was firing valley-wide "storm just hit" alerts off a
        // single metro-wide Flood Watch. Match roof-damaging event names instead.
        const nonRoof = ['chill', 'heat', 'freeze', 'frost', 'cold', 'flood', 'fog', 'air quality']
        if (nonRoof.some(k => event.includes(k))) return false
        return (
          event.includes('thunder') || // Severe Thunderstorm Warning/Watch (hail + damaging wind)
          event.includes('hail') ||
          event.includes('wind') || // High Wind / Wind Advisory / Extreme Wind
          event.includes('storm') || // Dust Storm (haboob), Ice/Winter/Tropical Storm
          event.includes('tornado') ||
          event.includes('hurricane')
        )
      })
      .map((f: any) => ({
        id: f.id ?? '',
        type: f.properties.event,
        headline: f.properties.headline ?? f.properties.event,
        description: f.properties.description ?? '',
        severity: f.properties.severity ?? 'Unknown',
      }))
  } catch {
    return []
  }
}

export async function getAlertsForZip(zip: string): Promise<WeatherAlert[]> {
  const point = await geocodeZip(zip)
  if (!point) return []
  return getAlertsForPoint(point.lat, point.lon)
}
