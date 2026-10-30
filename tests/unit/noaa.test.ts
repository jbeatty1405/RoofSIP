import { describe, it, expect, vi, afterEach } from 'vitest'
import { getAlertsForPoint, statedWindMph, scanStates, alertsAtPoint, pointInGeometry, rootAlertId, ALERT_LOOKBACK_MS } from '@/app/_lib/noaa'
import { localDateKey, zipState } from '@/app/_lib/timezone'

// Shapes a fake api.weather.gov /alerts/active response around one alert, with
// the three fields the filter reads. Defaults mirror what NWS actually sends for
// a Severe Thunderstorm Warning.
function alertFeature(overrides: Record<string, unknown> = {}) {
  return {
    id: 'urn:oid:test',
    properties: {
      event: 'Severe Thunderstorm Warning',
      certainty: 'Observed',
      urgency: 'Immediate',
      severity: 'Severe',
      headline: 'test headline',
      description: 'test description',
      ...overrides,
    },
  }
}

function mockAlerts(...features: ReturnType<typeof alertFeature>[]) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ features }),
  }))
}

afterEach(() => vi.unstubAllGlobals())

describe('getAlertsForPoint — watch vs warning', () => {
  // 2026-08-19: two Severe Thunderstorm Watches (Gila/Maricopa/Pinal and
  // Cochise/Graham/Pima/Santa Cruz) fired 197 hot leads and 7 homeowner texts on
  // a day Maricopa county recorded zero Severe Thunderstorm Warnings. A watch is
  // a multi-county forecast, not a storm hitting a roof.
  it('drops a Severe Thunderstorm Watch', async () => {
    mockAlerts(alertFeature({
      event: 'Severe Thunderstorm Watch',
      certainty: 'Possible',
      urgency: 'Future',
    }))
    expect(await getAlertsForPoint('33.4484', '-112.0740')).toEqual([])
  })

  it('keeps a Severe Thunderstorm Warning', async () => {
    mockAlerts(alertFeature())
    const alerts = await getAlertsForPoint('33.4484', '-112.0740')
    expect(alerts).toHaveLength(1)
    expect(alerts[0].type).toBe('Severe Thunderstorm Warning')
  })

  it('drops a Tornado Watch but keeps a Tornado Warning', async () => {
    mockAlerts(alertFeature({ event: 'Tornado Watch', certainty: 'Possible', urgency: 'Future' }))
    expect(await getAlertsForPoint('33.4484', '-112.0740')).toEqual([])

    mockAlerts(alertFeature({ event: 'Tornado Warning' }))
    expect(await getAlertsForPoint('33.4484', '-112.0740')).toHaveLength(1)
  })

  // 2026-10-15: Justin wants alerts only for storms that actually hit, so Wind
  // Advisories are dropped. High Wind warnings still pass, with no mph floor.
  it('drops a Wind Advisory', async () => {
    mockAlerts(alertFeature({ event: 'Wind Advisory', certainty: 'Likely', urgency: 'Expected', severity: 'Moderate' }))
    expect(await getAlertsForPoint('33.4484', '-112.0740')).toEqual([])
  })

  it('keeps a High Wind Warning', async () => {
    mockAlerts(alertFeature({ event: 'High Wind Warning', certainty: 'Observed', urgency: 'Immediate', severity: 'Severe' }))
    expect(await getAlertsForPoint('33.4484', '-112.0740')).toHaveLength(1)
  })

  // Dust is judged on stated wind speed, falling back to the product name only
  // when NWS states no speed. Justin chose the 40 mph floor on 2026-08-19 against
  // real alert data; it applies to dust ONLY and does not put a floor on wind.
  const dust = (event: string, description: string) =>
    alertFeature({ event, description, certainty: 'Observed', urgency: 'Immediate' })

  it('drops a windy Blowing Dust Advisory: advisories never fire', async () => {
    mockAlerts(dust('Blowing Dust Advisory', 'Strong thunderstorms with organized outflow wind gusts of 45-55 mph.'))
    expect(await getAlertsForPoint('33.4484', '-112.0740')).toEqual([])
  })

  it('drops a Blowing Dust Advisory that states no wind', async () => {
    mockAlerts(dust('Blowing Dust Advisory', 'Blowing dust reducing visibility.'))
    expect(await getAlertsForPoint('33.4484', '-112.0740')).toEqual([])
  })

  it('keeps a Dust Storm Warning that states no wind (visibility under 1/4 mile)', async () => {
    mockAlerts(dust('Dust Storm Warning', 'A dust storm was located near Flowing Wells.'))
    expect(await getAlertsForPoint('33.4484', '-112.0740')).toHaveLength(1)
  })

  it('drops a dust event whose stated wind is below the floor', async () => {
    mockAlerts(dust('Dust Storm Warning', 'Blowing dust with wind of 30 mph.'))
    expect(await getAlertsForPoint('33.4484', '-112.0740')).toEqual([])
  })

  it('reads the top of a range and survives the NWS line wrap', async () => {
    // NWS hard-wraps descriptions, so the number often lands on the next line.
    mockAlerts(dust('Dust Storm Warning', 'Less than a quarter mile visibility with strong wind in excess of\n50 mph.'))
    expect(await getAlertsForPoint('33.4484', '-112.0740')).toHaveLength(1)
  })

  // The trap a bare /(\d+) mph/ falls into: dust alerts state how fast the cell
  // is TRAVELLING, and reading that as wind suppresses a genuine haboob.
  it('does not mistake storm movement speed for wind speed', async () => {
    mockAlerts(dust('Dust Storm Warning', 'A dust storm was moving northwest at 10 mph.'))
    // Still fires, on the unquantified-warning fallback rather than a 10 mph read.
    expect(await getAlertsForPoint('33.4484', '-112.0740')).toHaveLength(1)

    mockAlerts(dust('Blowing Dust Advisory', 'A dust storm was moving northwest at 10 mph.'))
    expect(await getAlertsForPoint('33.4484', '-112.0740')).toEqual([])
  })

  // Regression guards for the 2026-07-15 Flood Watch incident. Still filtered.
  it('drops flood and heat alerts regardless of certainty', async () => {
    mockAlerts(
      alertFeature({ event: 'Flood Watch', certainty: 'Possible', urgency: 'Future' }),
      alertFeature({ event: 'Flash Flood Warning', certainty: 'Likely', urgency: 'Immediate' }),
      alertFeature({ event: 'Extreme Heat Warning', certainty: 'Likely', urgency: 'Expected' }),
    )
    expect(await getAlertsForPoint('33.4484', '-112.0740')).toEqual([])
  })

  // Belt and braces: the filter checks the event name, certainty and urgency
  // independently, so a watch is still dropped if NWS omits one of them.
  it('drops a watch even when certainty and urgency are missing', async () => {
    mockAlerts(alertFeature({ event: 'Severe Thunderstorm Watch', certainty: undefined, urgency: undefined }))
    expect(await getAlertsForPoint('33.4484', '-112.0740')).toEqual([])
  })
})

describe('getAlertsForPoint — observed only', () => {
  it('drops an advisory even if marked Observed', async () => {
    mockAlerts(alertFeature({ event: 'Wind Advisory' }), alertFeature({ event: 'Blowing Dust Advisory' }))
    expect(await getAlertsForPoint('33.4484', '-112.0740')).toEqual([])
  })

  it('drops a warning NWS marks Likely instead of Observed', async () => {
    mockAlerts(alertFeature({ event: 'High Wind Warning', certainty: 'Likely', urgency: 'Expected' }))
    expect(await getAlertsForPoint('33.4484', '-112.0740')).toEqual([])
  })

  it('drops an alert with no certainty', async () => {
    mockAlerts(alertFeature({ certainty: undefined }))
    expect(await getAlertsForPoint('33.4484', '-112.0740')).toEqual([])
  })
})

describe('getAlertsForPoint — onset', () => {
  const hours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString()

  // 2026-10-09: Wind Advisory issued the night before for Sunday texted homeowners early.
  it('holds a Wind Advisory whose onset is still in the future', async () => {
    mockAlerts(alertFeature({ event: 'Wind Advisory', certainty: 'Likely', urgency: 'Expected', onset: hours(40) }))
    expect(await getAlertsForPoint('33.4484', '-112.0740')).toEqual([])
  })

  it('passes a High Wind Warning once onset has passed', async () => {
    mockAlerts(alertFeature({ event: 'High Wind Warning', certainty: 'Observed', urgency: 'Immediate', onset: hours(-1) }))
    expect(await getAlertsForPoint('33.4484', '-112.0740')).toHaveLength(1)
  })

  it('passes an alert with no onset', async () => {
    mockAlerts(alertFeature({ event: 'High Wind Warning', certainty: 'Observed', urgency: 'Immediate', onset: null }))
    expect(await getAlertsForPoint('33.4484', '-112.0740')).toHaveLength(1)
  })
})

describe('statedWindMph', () => {
  it('reads wind and gust phrasings, taking the top of a range', () => {
    expect(statedWindMph('strong wind in excess of 50 mph')).toBe(50)
    expect(statedWindMph('organized outflow wind gusts of 45-55 mph')).toBe(55)
    expect(statedWindMph('winds up to 60 mph')).toBe(60)
  })

  it('ignores storm movement speed', () => {
    expect(statedWindMph('was moving northwest at 10 mph')).toBe(0)
    expect(statedWindMph('wind driven dust moving northwest at 10 mph')).toBe(0)
  })

  it('returns 0 when no speed is stated', () => {
    expect(statedWindMph('Blowing dust reducing visibility.')).toBe(0)
    expect(statedWindMph('')).toBe(0)
  })

  it('takes the highest speed when several are stated', () => {
    expect(statedWindMph('wind of 30 mph, later gusts of 55 mph')).toBe(55)
  })
})

describe('localDateKey', () => {
  // The storm-lead dedup used the UTC date, and UTC midnight is 5pm in Phoenix,
  // so runs at 3:18pm and 5:54pm MST on 2026-08-19 computed different "today"s
  // and re-notified the whole book.
  it('keeps 3:18pm and 5:54pm MST on the same Phoenix day', () => {
    const afternoon = new Date('2026-08-19T22:18:00Z') // 3:18pm MST
    const evening = new Date('2026-08-20T00:54:00Z')   // 5:54pm MST, next UTC day
    expect(localDateKey(afternoon, 'America/Phoenix')).toBe('2026-08-19')
    expect(localDateKey(evening, 'America/Phoenix')).toBe('2026-08-19')
    // The UTC date is what made these look like different days.
    expect(afternoon.toISOString().slice(0, 10)).not.toBe(evening.toISOString().slice(0, 10))
  })

  it('rolls over at local midnight, not UTC midnight', () => {
    expect(localDateKey(new Date('2026-08-20T06:59:00Z'), 'America/Phoenix')).toBe('2026-08-19') // 11:59pm
    expect(localDateKey(new Date('2026-08-20T07:01:00Z'), 'America/Phoenix')).toBe('2026-08-20') // 12:01am
  })

  it('resolves per timezone for the same instant', () => {
    const at = new Date('2026-08-20T02:00:00Z')
    expect(localDateKey(at, 'America/Phoenix')).toBe('2026-08-19')  // 7pm
    expect(localDateKey(at, 'America/New_York')).toBe('2026-08-19') // 10pm
    expect(localDateKey(at, 'Europe/London')).toBe('2026-08-20')    // 3am
  })
})

// The storm's end time feeds offer timing: no inspection is offered before it.
describe('getAlertsForPoint — end time', () => {
  it('carries NWS ends, falling back to expires', async () => {
    mockAlerts(
      alertFeature({ ends: '2026-10-11T17:00:00-07:00', expires: '2026-10-10T03:00:00-07:00' }),
      alertFeature({ expires: '2026-10-09T10:00:00-07:00' }),
    )
    const alerts = await getAlertsForPoint('33.4484', '-112.0740')
    expect(alerts.map(a => a.ends)).toEqual(['2026-10-11T17:00:00-07:00', '2026-10-09T10:00:00-07:00'])
  })
})

// The real polygon of the Oct 21 2026 Flagstaff Tornado Warning (FGZ, 9:22-9:45am
// MST). The hourly cron never ran inside it, so the house at 5743 E Jeremy Ln
// (86004) got no lead.
const FLAGSTAFF_TOR = {
  type: 'MultiPolygon',
  coordinates: [[[[-111.63, 35.14], [-111.71, 35.17], [-111.59, 35.4], [-111.38, 35.32], [-111.63, 35.14]]]],
}
const JEREMY_LN = { lat: '35.2655', lon: '-111.5459' }

describe('pointInGeometry', () => {
  it('places the Flagstaff house inside the Oct 21 tornado warning', () => {
    expect(pointInGeometry(-111.5459, 35.2655, FLAGSTAFF_TOR)).toBe(true)
  })
  it('keeps downtown Phoenix outside it', () => {
    expect(pointInGeometry(-112.074, 33.4484, FLAGSTAFF_TOR)).toBe(false)
  })
  it('respects a hole in a polygon', () => {
    const donut = {
      type: 'Polygon',
      coordinates: [
        [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
        [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
      ],
    }
    expect(pointInGeometry(2, 2, donut)).toBe(true)
    expect(pointInGeometry(5, 5, donut)).toBe(false)
  })
})

describe('rootAlertId', () => {
  it('keys an Update on the first message of its chain', () => {
    const update = {
      id: 'https://api.weather.gov/alerts/urn:oid:update2',
      properties: {
        references: [
          { identifier: 'urn:oid:update1', sent: '2026-10-21T09:30:00-07:00' },
          { identifier: 'urn:oid:original', sent: '2026-10-21T09:22:00-07:00' },
        ],
      },
    }
    expect(rootAlertId(update)).toBe('https://api.weather.gov/alerts/urn:oid:original')
  })
  it('uses its own id when it references nothing', () => {
    expect(rootAlertId({ id: 'https://api.weather.gov/alerts/urn:oid:x', properties: {} }))
      .toBe('https://api.weather.gov/alerts/urn:oid:x')
  })
})

describe('zipState', () => {
  it('maps the ZIPs RoofSIP actually holds', () => {
    expect(zipState('86004')).toBe('AZ')
    expect(zipState('85032')).toBe('AZ')
    expect(zipState('79901')).toBe('TX')
    expect(zipState('88510')).toBe('TX') // El Paso sits inside the NM block
    expect(zipState('87101')).toBe('NM')
  })
  it('returns null for junk', () => {
    expect(zipState('')).toBeNull()
    expect(zipState('abc')).toBeNull()
    expect(zipState(null)).toBeNull()
  })
})

describe('scanStates', () => {
  const NOW = Date.parse('2026-10-21T17:00:00Z')
  const torFeature = (overrides: Record<string, unknown> = {}) => ({
    id: 'https://api.weather.gov/alerts/urn:oid:tor',
    geometry: FLAGSTAFF_TOR,
    properties: {
      event: 'Tornado Warning',
      certainty: 'Observed',
      urgency: 'Immediate',
      severity: 'Extreme',
      messageType: 'Alert',
      sent: '2026-10-21T16:22:00Z',
      onset: '2026-10-21T16:22:00Z',
      ends: '2026-10-21T16:45:00Z',
      headline: 'Tornado Warning issued October 21',
      description: 'Ping pong ball size hail.',
      ...overrides,
    },
  })

  // Route each URL to its own fake response: /alerts/active vs /alerts?start=
  function mockNws(active: any[], recent: any[], status = 200) {
    const fetchMock = vi.fn(async (url: string) => ({
      ok: status === 200,
      status,
      json: async () => ({ features: url.includes('/alerts/active') ? active : recent }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  // The bug: by the next run the warning had expired and dropped out of
  // /alerts/active. The recent search still returns it.
  it('catches a warning that started and ended between two runs', async () => {
    mockNws([], [torFeature()])
    const { alerts, failedStates } = await scanStates(['AZ'], NOW)
    expect(failedStates).toEqual([])
    expect(alertsAtPoint(alerts, JEREMY_LN.lat, JEREMY_LN.lon).map(a => a.type)).toEqual(['Tornado Warning'])
    expect(alertsAtPoint(alerts, '33.4484', '-112.0740')).toEqual([])
  })

  it('asks NWS for nothing older than the lookback window', async () => {
    const fetchMock = mockNws([], [])
    await scanStates(['AZ'], NOW)
    const urls = fetchMock.mock.calls.map(c => c[0] as string)
    const start = new Date(NOW - ALERT_LOOKBACK_MS).toISOString().replace(/\.\d{3}Z$/, 'Z')
    expect(urls).toContain(`https://api.weather.gov/alerts?area=AZ&status=actual&start=${start}&limit=500`)
    expect(urls).toHaveLength(2) // one state = two requests, however many ZIPs
  })

  it('collapses an alert and its update into one storm keyed on the original', async () => {
    const update = torFeature({
      messageType: 'Update',
      sent: '2026-10-21T16:35:00Z',
      references: [{ identifier: 'urn:oid:tor', sent: '2026-10-21T16:22:00Z' }],
    })
    mockNws([], [torFeature(), { ...update, id: 'https://api.weather.gov/alerts/urn:oid:tor-upd' }])
    const { alerts } = await scanStates(['AZ'], NOW)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].alert.id).toBe('https://api.weather.gov/alerts/urn:oid:tor')
  })

  it('skips Cancel messages and still applies the watch filter', async () => {
    mockNws([], [
      torFeature({ messageType: 'Cancel' }),
      torFeature({ event: 'Severe Thunderstorm Watch', certainty: 'Possible', urgency: 'Future' }),
    ])
    const { alerts } = await scanStates(['AZ'], NOW)
    expect(alerts).toEqual([])
  })

  it('reports a failed state instead of returning clear skies', async () => {
    mockNws([], [], 503)
    const { alerts, failedStates } = await scanStates(['AZ'], NOW)
    expect(alerts).toEqual([])
    expect(failedStates).toEqual(['AZ'])
  })
})
