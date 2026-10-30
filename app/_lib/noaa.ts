export type WeatherAlert = {
  id: string
  type: string
  headline: string
  description: string
  severity: string
  /** When the weather is expected to be over (NWS `ends`, else `expires`). ISO, or null. */
  ends?: string | null
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

const NWS_HEADERS = { 'User-Agent': 'RoofSIP/1.0 (jbeatty1405@yahoo.com)', Accept: 'application/geo+json' }

/** Is this NWS alert feature roof-damaging weather that has actually started? */
export function qualifiesForLead(f: any): boolean {
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
  // Hold alerts that have not started. NWS issues advisories ahead of time:
  // `effective` is when it was issued, `onset` is when the weather begins.
  // 2026-10-09: a Wind Advisory issued the night before for Sunday 8am-5pm
  // texted 4 homeowners "weather near your home" before any wind. The alert
  // stays in the feed, so it sends on a later run once onset passes.
  const onset = Date.parse(f.properties?.onset ?? '')
  if (!Number.isNaN(onset) && onset > Date.now()) return false
  // Wind Advisory is breezy weather, not damage. 2026-10-15: one fired
  // "storm just hit" at a Flagstaff homeowner. Justin: only alert on storms
  // that actually hit. High Wind / Extreme Wind warnings still pass below.
  if (event.includes('wind advisory')) return false
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
}

function toWeatherAlert(f: any, id: string = f.id ?? ''): WeatherAlert {
  return {
    id,
    type: f.properties.event,
    headline: f.properties.headline ?? f.properties.event,
    description: f.properties.description ?? '',
    severity: f.properties.severity ?? 'Unknown',
    ends: f.properties.ends ?? f.properties.expires ?? null,
  }
}

export async function getAlertsForPoint(lat: string, lon: string): Promise<WeatherAlert[]> {
  try {
    const res = await fetch(
      `https://api.weather.gov/alerts/active?point=${parseFloat(lat).toFixed(4)},${parseFloat(lon).toFixed(4)}`,
      { headers: NWS_HEADERS }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.features ?? []).filter(qualifiesForLead).map((f: any) => toWeatherAlert(f))
  } catch {
    return []
  }
}

// ── State-wide scan ─────────────────────────────────────────────────────────
// The cron used to ask NWS "what is active at this point RIGHT NOW?" once per
// ZIP. Warnings last 15-45 minutes and GitHub ran the hourly cron only every
// 4-7 hours, so from Sep 16 to Oct 30 2026 Justin's own 5 SIP houses sat inside
// 11 warnings (hail up to 2.5", a Flagstaff tornado warning) and a run landed
// inside exactly zero of them. Zero leads.
//
// Now each run asks once per state for everything active plus everything issued
// in the last ALERT_LOOKBACK_MS, and matches the polygons against each ZIP here.
// A warning that started and ended between two runs is still caught.
//
// The lookback is deliberately short. It covers a late or skipped run, not
// history: a storm older than this is never turned into a "storm just hit" text
// days later (Justin, 2026-10-30: no retroactive alerts).
export const ALERT_LOOKBACK_MS = 60 * 60 * 1000

/** A qualifying alert plus what we need to place it on the map. */
export type ScannedAlert = {
  alert: WeatherAlert
  sent: number
  geometry: any
  zones: string[]
}

/**
 * The id of the first message in an alert's chain. NWS re-issues a warning as
 * an Update with a new id each time it changes the polygon or the hail size; the
 * Update lists every earlier message in `references`. Keying sends on the root
 * means a warning that is updated three times is still one storm, not three, so
 * the severe-hail cooldown bypass can't re-text a homeowner off an update.
 * Kept in the same URL form as `feature.id` so it lines up with older sms_logs.
 */
export function rootAlertId(f: any): string {
  const refs: any[] = f.properties?.references ?? []
  if (!refs.length) return f.id ?? ''
  const first = [...refs].sort((a, b) => Date.parse(a.sent) - Date.parse(b.sent))[0]
  return first?.identifier ? `https://api.weather.gov/alerts/${first.identifier}` : f.id ?? ''
}

async function fetchFeatures(url: string): Promise<any[]> {
  const res = await fetch(url, { headers: NWS_HEADERS })
  if (!res.ok) throw new Error(`NWS HTTP ${res.status} for ${url}`)
  const data = await res.json()
  return data.features ?? []
}

// Zone outlines barely ever change, so keep them for the life of the instance.
const zoneGeometryCache = new Map<string, any>()

async function zoneGeometry(url: string): Promise<any> {
  if (!zoneGeometryCache.has(url)) {
    const res = await fetch(url, { headers: NWS_HEADERS })
    if (!res.ok) throw new Error(`NWS zone HTTP ${res.status} for ${url}`)
    zoneGeometryCache.set(url, (await res.json()).geometry ?? null)
  }
  return zoneGeometryCache.get(url)
}

/**
 * Every qualifying alert active now or issued in the lookback window, for the
 * given two-letter states. Two NWS requests per state, whatever the number of
 * ZIPs. A state whose scan fails is returned in `failedStates` so the caller
 * can report its ZIPs as blind instead of mistaking the outage for clear skies.
 */
export async function scanStates(
  states: string[],
  now: number = Date.now(),
): Promise<{ alerts: ScannedAlert[]; failedStates: string[] }> {
  const start = new Date(now - ALERT_LOOKBACK_MS).toISOString().replace(/\.\d{3}Z$/, 'Z')
  const byRoot = new Map<string, ScannedAlert>()
  const failedStates: string[] = []

  await Promise.all(states.map(async (state) => {
    try {
      const [active, recent] = await Promise.all([
        fetchFeatures(`https://api.weather.gov/alerts/active?area=${state}&status=actual`),
        fetchFeatures(`https://api.weather.gov/alerts?area=${state}&status=actual&start=${start}&limit=500`),
      ])
      const found: ScannedAlert[] = []
      for (const f of [...active, ...recent]) {
        // A Cancel ends a warning early; the storm it described still happened,
        // and the original message is in the same feed.
        if (f.properties?.messageType === 'Cancel') continue
        if (!qualifiesForLead(f)) continue
        const zones: string[] = f.properties?.affectedZones ?? []
        // Zone-based alerts (High Wind, Winter Storm) carry no polygon of their
        // own; borrow the outlines of the zones they cover.
        const geometry = f.geometry ?? {
          type: 'GeometryCollection',
          geometries: await Promise.all(zones.map(zoneGeometry)),
        }
        found.push({ alert: toWeatherAlert(f, rootAlertId(f)), sent: Date.parse(f.properties?.sent ?? ''), geometry, zones })
      }
      for (const s of found) {
        // Keep the newest message of each chain: it has the current polygon and end time.
        const prev = byRoot.get(s.alert.id)
        if (!prev || s.sent > prev.sent) byRoot.set(s.alert.id, s)
      }
    } catch (err) {
      console.error(`[noaa] state scan failed for ${state}:`, err)
      failedStates.push(state)
    }
  }))

  const alerts = [...byRoot.values()].sort((a, b) => b.sent - a.sent)
  return { alerts, failedStates }
}

// Even-odd ray cast over every ring, so holes in a polygon come out right.
function inRings(x: number, y: number, rings: number[][][]): boolean {
  let inside = false
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]
      const [xj, yj] = ring[j]
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
    }
  }
  return inside
}

export function pointInGeometry(lon: number, lat: number, geometry: any): boolean {
  if (!geometry) return false
  switch (geometry.type) {
    case 'Polygon':
      return inRings(lon, lat, geometry.coordinates)
    case 'MultiPolygon':
      return geometry.coordinates.some((poly: number[][][]) => inRings(lon, lat, poly))
    case 'GeometryCollection':
      return geometry.geometries.some((g: any) => pointInGeometry(lon, lat, g))
    default:
      return false
  }
}

/** The scanned alerts that cover this point, newest first. */
export function alertsAtPoint(scanned: ScannedAlert[], lat: string, lon: string): WeatherAlert[] {
  const x = parseFloat(lon)
  const y = parseFloat(lat)
  return scanned.filter(s => pointInGeometry(x, y, s.geometry)).map(s => s.alert)
}

export async function getAlertsForZip(zip: string): Promise<WeatherAlert[]> {
  const point = await geocodeZip(zip)
  if (!point) return []
  return getAlertsForPoint(point.lat, point.lon)
}
