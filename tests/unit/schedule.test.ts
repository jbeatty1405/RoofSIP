import { describe, it, expect } from 'vitest'
import { getRooferSchedule, getNextAvailableSlot, DEFAULT_MARKET } from '@/app/_lib/markets'

// Working hours moved off `markets` (UI deleted) onto the roofer's profile.
// Scheduling must never dead-end: a missing or empty profile row has to fall
// back to DEFAULT_MARKET, or getNextAvailableSlot can't place an inspection.
function fakeSupabase(row: unknown) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row }),
        }),
      }),
    }),
  } as never
}

describe('getRooferSchedule', () => {
  it('uses the hours the roofer saved in Settings', async () => {
    const schedule = await getRooferSchedule(
      fakeSupabase({ working_days: [1, 3, 5], working_hours_start: '07:00:00', working_hours_end: '19:00:00' }),
      'roofer-1'
    )
    expect(schedule.working_days).toEqual([1, 3, 5])
    expect(schedule.working_hours_start).toBe('07:00:00')
    expect(schedule.working_hours_end).toBe('19:00:00')
    expect(schedule.roofer_id).toBe('roofer-1')
  })

  it('falls back to DEFAULT_MARKET when the profile row is missing', async () => {
    const schedule = await getRooferSchedule(fakeSupabase(null), 'roofer-1')
    expect(schedule).toEqual(DEFAULT_MARKET)
  })

  it('falls back when working_days is empty, so no homeowner is unbookable', async () => {
    const schedule = await getRooferSchedule(
      fakeSupabase({ working_days: [], working_hours_start: '09:00:00', working_hours_end: '10:00:00' }),
      'roofer-1'
    )
    expect(schedule).toEqual(DEFAULT_MARKET)
  })

  it('keeps DEFAULT_MARKET hours when the columns come back null', async () => {
    const schedule = await getRooferSchedule(
      fakeSupabase({ working_days: [2, 4], working_hours_start: null, working_hours_end: null }),
      'roofer-1'
    )
    expect(schedule.working_days).toEqual([2, 4])
    expect(schedule.working_hours_start).toBe(DEFAULT_MARKET.working_hours_start)
    expect(schedule.working_hours_end).toBe(DEFAULT_MARKET.working_hours_end)
  })
})

// Offer timing. 2026-10-09: a storm run at 8:45am offered "today at 9:00 AM",
// 15 minutes out. Same-day offers now start MIN_LEAD_HOURS (3) out, and never
// before the alert's end time, so nobody is booked onto a roof mid-storm.
describe('getNextAvailableSlot offer timing', () => {
  const TZ = 'America/Phoenix' // UTC-7, no DST
  const market = {
    id: 'm', roofer_id: 'r', name: 'x', auto_schedule: true,
    working_days: [1, 2, 3, 4, 5, 6, 7], working_hours_start: '08:00:00', working_hours_end: '17:00:00',
  }
  function slotsDb(taken: string[] = []) {
    return {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            or: async () => ({ data: [] }), // blocked_dates
            in: () => ({ not: async () => ({ data: table === 'pending_bookings' ? taken.map(t => ({ proposed_slot: t })) : [] }) }),
          }),
        }),
      }),
    } as never
  }
  const at = (iso: string) => new Date(iso)

  it('8:45am storm offers noon, not 9am', async () => {
    const s = await getNextAvailableSlot(slotsDb(), market, 'r', TZ, null, at('2026-10-09T15:45:00Z'))
    expect(s.toISOString()).toBe('2026-10-09T19:00:00.000Z') // 12:00 MST
  })

  it('on the hour: 8:00am offers 11:00am', async () => {
    const s = await getNextAvailableSlot(slotsDb(), market, 'r', TZ, null, at('2026-10-09T15:00:00Z'))
    expect(s.toISOString()).toBe('2026-10-09T18:00:00.000Z')
  })

  it('2pm storm rolls to the next morning (5pm is past the last slot)', async () => {
    const s = await getNextAvailableSlot(slotsDb(), market, 'r', TZ, null, at('2026-10-09T21:00:00Z'))
    expect(s.toISOString()).toBe('2026-10-10T15:00:00.000Z') // Sat 8:00 MST
  })

  it('waits for the storm to end: an all-day wind advisory pushes to the next day', async () => {
    // Sunday 8:15am, advisory runs until 5pm Sunday
    const s = await getNextAvailableSlot(slotsDb(), market, 'r', TZ, at('2026-10-12T00:00:00Z'), at('2026-10-11T15:15:00Z'))
    expect(s.toISOString()).toBe('2026-10-12T15:00:00.000Z') // Mon 8:00 MST
  })

  it('a storm ending sooner than the lead time does not shorten it', async () => {
    const s = await getNextAvailableSlot(slotsDb(), market, 'r', TZ, at('2026-10-09T16:30:00Z'), at('2026-10-09T15:45:00Z'))
    expect(s.toISOString()).toBe('2026-10-09T19:00:00.000Z')
  })

  it('skips a slot already held for another homeowner', async () => {
    const s = await getNextAvailableSlot(slotsDb(['2026-10-09T19:00:00.000Z']), market, 'r', TZ, null, at('2026-10-09T15:45:00Z'))
    expect(s.toISOString()).toBe('2026-10-09T20:00:00.000Z')
  })
})
