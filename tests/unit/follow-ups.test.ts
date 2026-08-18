import { describe, it, expect } from 'vitest'
import { alreadyNotifiedIds } from '@/app/_lib/follow-ups'

const HO = 'homeowner-1'
const ALERT = '2026-08-11T18:00:00.000Z'

describe('alreadyNotifiedIds', () => {
  it('lets the first follow-up through when nothing was sent yet', () => {
    const notified = alreadyNotifiedIds([{ homeowner_id: HO, alertTime: ALERT }], [])
    expect(notified.has(HO)).toBe(false)
  })

  it('blocks every later run once a call_needed exists for that alert', () => {
    // The regression: window is 48h wide, job runs hourly, so this same candidate
    // comes back ~48 times and used to insert a notification on each pass.
    const notified = alreadyNotifiedIds(
      [{ homeowner_id: HO, alertTime: ALERT }],
      [{ homeowner_id: HO, created_at: '2026-08-13T18:00:00.000Z' }],
    )
    expect(notified.has(HO)).toBe(true)
  })

  it('stays blocked no matter how many duplicates already landed', () => {
    const dupes = Array.from({ length: 20 }, (_, i) => ({
      homeowner_id: HO,
      created_at: `2026-08-13T${String(i).padStart(2, '0')}:00:00.000Z`,
    }))
    expect(alreadyNotifiedIds([{ homeowner_id: HO, alertTime: ALERT }], dupes).has(HO)).toBe(true)
  })

  it('allows a fresh follow-up for a later storm', () => {
    // Notification is from the PREVIOUS storm cycle, older than this alert, so the
    // new alert has to be able to raise its own call.
    const notified = alreadyNotifiedIds(
      [{ homeowner_id: HO, alertTime: '2026-08-16T18:00:00.000Z' }],
      [{ homeowner_id: HO, created_at: '2026-08-13T18:00:00.000Z' }],
    )
    expect(notified.has(HO)).toBe(false)
  })

  it('does not let one homeowner suppress another', () => {
    const notified = alreadyNotifiedIds(
      [
        { homeowner_id: HO, alertTime: ALERT },
        { homeowner_id: 'homeowner-2', alertTime: ALERT },
      ],
      [{ homeowner_id: HO, created_at: '2026-08-13T18:00:00.000Z' }],
    )
    expect(notified.has(HO)).toBe(true)
    expect(notified.has('homeowner-2')).toBe(false)
  })

  it('ignores notifications for homeowners not up for follow-up', () => {
    const notified = alreadyNotifiedIds(
      [{ homeowner_id: HO, alertTime: ALERT }],
      [{ homeowner_id: 'someone-else', created_at: '2026-08-13T18:00:00.000Z' }],
    )
    expect(notified.size).toBe(0)
  })
})
