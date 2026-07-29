import { describe, it, expect } from 'vitest'
import { getRooferSchedule, DEFAULT_MARKET } from '@/app/_lib/markets'

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
