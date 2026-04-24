export type WeatherAlert = {
  type: string
  headline: string
  description: string
  severity: string
}

export async function getAlertsForZip(zip: string): Promise<WeatherAlert[]> {
  // NOAA requires a point lookup first — use zip to lat/lon via nominatim
  const geoRes = await fetch(
    `https://nominatim.openstreetmap.org/search?postalcode=${zip}&country=US&format=json&limit=1`,
    { headers: { 'User-Agent': 'RoofSIP/1.0 (jbeatty1405@yahoo.com)' } }
  )
  const geoData = await geoRes.json()
  if (!geoData.length) return []

  const { lat, lon } = geoData[0]

  const alertRes = await fetch(
    `https://api.weather.gov/alerts/active?point=${parseFloat(lat).toFixed(4)},${parseFloat(lon).toFixed(4)}`,
    { headers: { 'User-Agent': 'RoofSIP/1.0 (jbeatty1405@yahoo.com)', Accept: 'application/geo+json' } }
  )
  if (!alertRes.ok) return []

  const alertData = await alertRes.json()
  const features = alertData.features ?? []

  return features
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
      type: f.properties.event,
      headline: f.properties.headline ?? f.properties.event,
      description: f.properties.description ?? '',
      severity: f.properties.severity ?? 'Unknown',
    }))
}
