import { describe, it, expect, vi, afterEach } from 'vitest'
import { getAlertsForPoint } from '@/app/_lib/noaa'
import { localDateKey } from '@/app/_lib/timezone'

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

  // Justin's standing rule: keep 'wind' broad, no mph floor. Excluding watches
  // must not take advisories with it — NWS sends those as Likely/Expected.
  it('keeps a Wind Advisory', async () => {
    mockAlerts(alertFeature({ event: 'Wind Advisory', certainty: 'Likely', urgency: 'Expected', severity: 'Moderate' }))
    expect(await getAlertsForPoint('33.4484', '-112.0740')).toHaveLength(1)
  })

  it('keeps a Dust Storm Warning (haboob)', async () => {
    mockAlerts(alertFeature({ event: 'Dust Storm Warning', certainty: 'Likely', urgency: 'Expected' }))
    expect(await getAlertsForPoint('33.4484', '-112.0740')).toHaveLength(1)
  })

  // Pins existing behavior, NOT a consequence of the watch filter: 'Blowing Dust
  // Advisory' contains none of the allowed keywords (thunder/hail/wind/storm/
  // tornado/hurricane), so it has always been dropped while 'Dust Storm Warning'
  // passes on 'storm'. Flagged to Justin 2026-08-19; left as-is pending his call.
  it('drops a Blowing Dust Advisory (no allowed keyword in the event name)', async () => {
    mockAlerts(alertFeature({ event: 'Blowing Dust Advisory', certainty: 'Likely', urgency: 'Expected' }))
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
