'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type Homeowner = {
  id: string
  name: string
  phone: string
  address: string
  zip_code: string
  status: 'pending' | 'sms_sent' | 'booked'
}

type Alert = {
  id: string
  type: string
  headline: string
  severity: string
  counties: string[]
}

const STATUS_COLOR: Record<string, string> = {
  pending: '#94a3b8',
  sms_sent: '#0ea5e9',
  booked: '#22c55e',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'No SMS sent',
  sms_sent: 'SMS sent today',
  booked: 'Inspection booked',
}

export default function StormMap({ homeowners }: { homeowners: Homeowner[] }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const [selected, setSelected] = useState<Homeowner | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    async function init() {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')

      const map = L.map(mapRef.current!, {
        center: [37.5, -96],
        zoom: 5,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 18,
      }).addTo(map)

      mapInstanceRef.current = map

      // Load NOAA active alerts GeoJSON
      try {
        const res = await fetch('https://api.weather.gov/alerts/active?status=actual&message_type=alert', {
          headers: { Accept: 'application/geo+json', 'User-Agent': 'RoofSIP/1.0 (jbeatty1405@yahoo.com)' }
        })
        const data = await res.json()
        const features = (data.features ?? []).filter((f: any) => {
          const event = (f.properties?.event ?? '').toLowerCase()
          const sev = (f.properties?.severity ?? '').toLowerCase()
          return event.includes('thunder') || event.includes('hail') || event.includes('wind') ||
            event.includes('rain') || event.includes('storm') || sev === 'severe' || sev === 'extreme'
        })

        const alertList: Alert[] = features.map((f: any) => ({
          id: f.id,
          type: f.properties.event,
          headline: f.properties.headline ?? f.properties.event,
          severity: f.properties.severity,
          counties: [],
        }))
        setAlerts(alertList)

        L.geoJSON(
          { type: 'FeatureCollection', features } as any,
          {
            style: (feature: any) => {
              const sev = (feature?.properties?.severity ?? '').toLowerCase()
              return {
                fillColor: sev === 'extreme' ? '#ef4444' : sev === 'severe' ? '#f97316' : '#fbbf24',
                fillOpacity: 0.25,
                color: sev === 'extreme' ? '#ef4444' : sev === 'severe' ? '#f97316' : '#fbbf24',
                weight: 1.5,
              }
            },
            onEachFeature: (feature: any, layer: any) => {
              layer.bindPopup(`
                <div style="font-family:sans-serif;font-size:13px;max-width:220px">
                  <p style="font-weight:600;margin:0 0 4px">${feature.properties.event}</p>
                  <p style="color:#64748b;margin:0;font-size:11px">${feature.properties.headline ?? ''}</p>
                </div>
              `)
            },
          }
        ).addTo(map)
      } catch (e) {
        // NOAA may be unavailable — map still works with pins
      }

      // Geocode homeowners and place pins
      for (const h of homeowners) {
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(h.address)}&format=json&limit=1`,
            { headers: { 'User-Agent': 'RoofSIP/1.0 (jbeatty1405@yahoo.com)' } }
          )
          const geoData = await geoRes.json()
          if (!geoData.length) continue

          const { lat, lon } = geoData[0]
          const color = STATUS_COLOR[h.status]
          const isPending = h.status === 'pending'

          const icon = L.divIcon({
            html: `<div style="
              width:14px;height:14px;border-radius:50%;
              background:${color};
              border:2.5px solid white;
              box-shadow:0 0 0 ${isPending ? '0' : '3px'} ${color}44;
              ${isPending ? '' : 'animation:pulse 2s infinite;'}
            "></div>`,
            className: '',
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          })

          const marker = L.marker([parseFloat(lat), parseFloat(lon)], { icon })
          marker.addTo(map)
          marker.on('click', () => setSelected(h))
        } catch (e) {
          // Skip failed geocode
        }
      }

      setLoading(false)

      if (homeowners.length > 0) {
        const bounds = map.getBounds()
        if (!bounds.isValid()) {
          map.setView([37.5, -96], 5)
        }
      }
    }

    init()
  }, [homeowners])

  return (
    <div className="relative w-full h-full">
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
          50% { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
        }
      `}</style>

      {loading && (
        <div className="absolute inset-0 bg-zinc-50 flex items-center justify-center z-10 pointer-events-none">
          <div className="text-sm text-zinc-400">Loading map...</div>
        </div>
      )}

      <div ref={mapRef} className="w-full h-full min-h-[500px]" />

      {/* Alert count badge */}
      {alerts.length > 0 && (
        <div className="absolute top-4 left-4 z-[1000] bg-red-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-md">
          {alerts.length} active storm alert{alerts.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Selected homeowner panel */}
      {selected && (
        <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-white border-t border-zinc-200 p-5 shadow-xl">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ background: STATUS_COLOR[selected.status] }}
                />
                <p className="font-semibold text-zinc-900">{selected.name}</p>
              </div>
              <p className="text-sm text-zinc-500">{selected.address}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{STATUS_LABEL[selected.status]}</p>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-zinc-400 hover:text-zinc-700 text-xl leading-none"
            >
              ×
            </button>
          </div>
          <div className="flex gap-2">
            <a
              href={`tel:${selected.phone}`}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.45 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.64a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              Call
            </a>
            <Link
              href={`/homeowners/${selected.id}`}
              className="flex-1 flex items-center justify-center py-2 border border-zinc-300 text-zinc-700 text-sm font-medium rounded-lg hover:bg-zinc-50 transition-colors"
            >
              View profile
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
