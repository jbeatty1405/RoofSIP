export type WeatherAlert = {
  id: string
  type: string
  headline: string
  description: string
  severity: string
}

export async function geocodeZip(zip: string): Promise<{ lat: string; lon: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${zip}&country=US&format=json&limit=1`,
      { headers: { 'User-Agent': 'RoofSIP/1.0 (jbeatty1405@yahoo.com)' } }
    )
    const data = await res.json()
    if (!data.length) return null
    return { lat: data[0].lat, lon: data[0].lon }
  } catch {
    return null
  }
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
        return (
          event.includes('thunder') ||
          event.includes('hail') ||
          event.includes('wind') ||
          event.includes('rain') ||
          event.includes('storm') ||
          severity === 'severe' ||
          severity === 'extreme'
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
