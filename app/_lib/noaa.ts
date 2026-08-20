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

/**
 * Highest wind speed in mph stated in an alert's text, or 0 if it states none.
 *
 * Anchored on the words wind/gust because dust alerts also carry the speed the
 * storm cell is TRAVELLING at — "moving northwest at 10 mph" — and a bare
 * /(\d+) mph/ reads that as a 10 mph wind and suppresses a genuine haboob. The
 * gap is capped at 24 characters and the class excludes digits and punctuation,
 * so a match cannot wander across a sentence ("wind driven dust moving
 * northwest at 10 mph" is 33 characters from 'wind' to the number, so it is
 * correctly ignored).
 *
 * Ranges take the top of the range: "gusts of 45-55 mph" is a 55 mph event.
 */
export function statedWindMph(text: string): number {
  // NWS hard-wraps descriptions, so the number often sits on the next line
  // ("strong wind in excess of\n50 mph"). Collapse whitespace first or the
  // character class below stops at the newline and every speed reads as unstated.
  const flat = text.replace(/\s+/g, ' ')
  const re = /\b(?:wind|gust)s?\b[a-z ]{0,24}?(\d{2,3})(?:\s*-\s*(\d{2,3}))?\s*mph/gi
  let best = 0
  for (const m of flat.matchAll(re)) {
    best = Math.max(best, parseInt(m[2] ?? m[1], 10))
  }
  return best
}

/** Wind at or above this damages a roof. Dust events only — see the note below. */
const DUST_WIND_FLOOR_MPH = 40

/**
 * Should a blowing-dust event raise a lead?
 *
 * The NWS product name is a poor proxy for wind here, which is why this is not
 * left to the keyword list. Sampling every AZ dust alert in Aug 2026: the two
 * windiest events (45-55 mph gusts) were Blowing Dust ADVISORIES, while three
 * Dust Storm WARNINGS stated no wind speed at all. Going on the label alone both
 * missed the strongest events and fired on unquantified weaker ones.
 *
 * So: trust a stated wind speed when there is one, and fall back to the label
 * only when there is not. Only 3 of 14 alerts that month stated a speed, so the
 * fallback carries most of the traffic. A Dust Storm Warning requires visibility
 * under a quarter mile, which NWS only issues for the severe end, so an
 * unquantified one is kept; an unquantified advisory is not.
 *
 * 40 mph matches the bar Wind Advisories already clear. Justin's standing rule
 * is NO mph floor on wind alerts (High Wind / Wind Advisory / Extreme Wind all
 * pass unconditionally) and this does not change that — the floor here applies
 * to dust events only. Chosen 2026-08-19 against real alert data.
 */
function dustEventQualifies(event: string, text: string): boolean {
  const wind = statedWindMph(text)
  if (wind > 0) return wind >= DUST_WIND_FLOOR_MPH
  return event.includes('warning')
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
        const certainty = (f.properties?.certainty ?? '').toLowerCase()
        const urgency = (f.properties?.urgency ?? '').toLowerCase()
        // A WATCH is a forecast, not an event: "conditions are favorable somewhere
        // in these counties over the next several hours". NWS issues them per
        // multi-county area, so a single Severe Thunderstorm Watch covers the whole
        // metro and fires "storm just hit" at every homeowner we hold. That is
        // exactly what happened 2026-08-19: two watches (Gila/Maricopa/Pinal and
        // Cochise/Graham/Pima/Santa Cruz) produced 197 hot leads and 7 homeowner
        // texts on a day Maricopa recorded zero Severe Thunderstorm Warnings.
        //
        // This is the same failure shape as the 2026-07-15 Flood Watch incident,
        // through a different door: that fix filtered on the event NOUN (is this
        // weather roof-damaging?) and never on CERTAINTY (did it actually happen?).
        // 'Severe Thunderstorm Watch' passes the noun test perfectly.
        //
        // Checked three ways because NWS sets all three consistently and any one
        // alone is a single point of failure. Verified against every AZ alert on
        // 2026-08-19: watches were the only Possible/Future rows, while warnings
        // were Observed and advisories (incl. Blowing Dust, and Wind Advisory,
        // which Justin wants kept broad with no mph floor) were Likely/Expected.
        if (event.includes('watch')) return false
        if (certainty === 'possible' || urgency === 'future') return false
        // Temperature alerts (Wind Chill, Excessive Heat, Hard Freeze, Frost,
        // Extreme Cold) match 'wind'/severity but mean nothing for roofs. Drop them.
        // Only trigger on things that actually damage a roof. We deliberately do
        // NOT pass on severity alone: NWS tags Flood Watches / Flash Flood
        // Warnings as "Severe", and flooding does nothing to a roof. That
        // severity catch-all was firing valley-wide "storm just hit" alerts off a
        // single metro-wide Flood Watch. Match roof-damaging event names instead.
        const nonRoof = ['chill', 'heat', 'freeze', 'frost', 'cold', 'flood', 'fog', 'air quality']
        if (nonRoof.some(k => event.includes(k))) return false

        // Dust is decided on wind speed, not on the product name. This must sit
        // ahead of the keyword list below: 'Dust Storm Warning' contains 'storm'
        // and would otherwise pass unconditionally, and 'Blowing Dust Advisory'
        // contains no listed keyword at all so it could never pass, which is
        // backwards — the advisories are frequently the windier of the two.
        if (event.includes('dust')) {
          const text = `${f.properties?.description ?? ''} ${f.properties?.headline ?? ''}`
          return dustEventQualifies(event, text)
        }

        return (
          event.includes('thunder') || // Severe Thunderstorm Warning (hail + damaging wind)
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
