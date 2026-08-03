import { describe, it, expect, afterEach, vi } from 'vitest'
import { zipTimezone, stateTimezone, rooferTimezone, toWallClock, fromWallClock, hourIn } from '@/app/_lib/timezone'
import { isQuietHoursForZip, isQuietHoursEverywhere } from '@/app/_lib/schedule'

// The bug this covers: quiet hours were evaluated once in America/Phoenix for
// every homeowner, so a Virginia homeowner could be texted at midnight local.

describe('zipTimezone', () => {
  it('places Arizona ZIPs in Phoenix, which has no DST', () => {
    expect(zipTimezone('85381')).toEqual({ tz: 'America/Phoenix', confident: true })
    expect(zipTimezone('86001')).toEqual({ tz: 'America/Phoenix', confident: true })
  })

  it('places the Virginia ZIP already in the database on Eastern', () => {
    expect(zipTimezone('23000').tz).toBe('America/New_York')
  })

  it('handles ZIP+4 and stray formatting', () => {
    expect(zipTimezone('85381-5188').tz).toBe('America/Phoenix')
    expect(zipTimezone(' 90210 ').tz).toBe('America/Los_Angeles')
  })

  it('covers the coasts and the middle', () => {
    expect(zipTimezone('10001').tz).toBe('America/New_York')   // NYC
    expect(zipTimezone('60601').tz).toBe('America/Chicago')    // Chicago
    expect(zipTimezone('80202').tz).toBe('America/Denver')     // Denver
    expect(zipTimezone('98101').tz).toBe('America/Los_Angeles') // Seattle
    expect(zipTimezone('99501').tz).toBe('America/Anchorage')  // Anchorage
    expect(zipTimezone('96801').tz).toBe('Pacific/Honolulu')   // Honolulu
  })

  it('marks split-timezone states as not confident so the window narrows', () => {
    expect(zipTimezone('37201')).toEqual({ tz: 'America/Chicago', confident: false })  // Nashville
    expect(zipTimezone('37901')).toEqual({ tz: 'America/New_York', confident: false }) // Knoxville
    expect(zipTimezone('79901')).toEqual({ tz: 'America/Denver', confident: false })   // El Paso
    expect(zipTimezone('75201').confident).toBe(false)                                 // Dallas, split state
  })

  it('never throws on junk, and is never confident about it', () => {
    for (const junk of [null, undefined, '', 'abc', '1', '00']) {
      const r = zipTimezone(junk as any)
      expect(typeof r.tz).toBe('string')
      expect(r.confident).toBe(false)
    }
  })
})

describe('stateTimezone / rooferTimezone', () => {
  it('reads the state the roofer signed up in', () => {
    expect(rooferTimezone({ billing_state: 'AZ' })).toBe('America/Phoenix')
    expect(rooferTimezone({ billing_state: 'tx' })).toBe('America/Chicago')
    expect(rooferTimezone({ billing_state: 'CA' })).toBe('America/Los_Angeles')
  })

  it('falls back rather than throwing when the state is missing', () => {
    expect(rooferTimezone(null)).toBe('America/Denver')
    expect(rooferTimezone({ billing_state: null })).toBe('America/Denver')
    expect(stateTimezone('ZZ').confident).toBe(false)
  })
})

describe('wall-clock conversion', () => {
  it('round-trips through a timezone', () => {
    for (const tz of ['America/Phoenix', 'America/New_York', 'America/Anchorage']) {
      const instant = new Date('2026-08-03T17:30:00Z')
      const back = fromWallClock(toWallClock(instant, tz), tz)
      expect(back.getTime()).toBe(instant.getTime())
    }
  })

  it('respects DST where it applies, and ignores it in Arizona', () => {
    const summer = new Date('2026-07-01T18:00:00Z')
    const winter = new Date('2026-01-01T18:00:00Z')
    // Phoenix is UTC-7 all year
    expect(hourIn('America/Phoenix', summer)).toBe(11)
    expect(hourIn('America/Phoenix', winter)).toBe(11)
    // New York shifts by an hour between EDT and EST
    expect(hourIn('America/New_York', summer)).toBe(14)
    expect(hourIn('America/New_York', winter)).toBe(13)
  })
})

describe('isQuietHoursForZip', () => {
  afterEach(() => vi.useRealTimers())

  // 2026-08-03 03:30 UTC = 8:30pm Phoenix (Aug 2) = 11:30pm Eastern (Aug 2).
  // The old global Phoenix check said "fine, send it" for everyone.
  const lateEastern = new Date('2026-08-03T03:30:00Z')

  it('is open in Arizona but closed on the east coast at the same instant', () => {
    vi.setSystemTime(lateEastern)
    expect(isQuietHoursForZip('85381')).toBe(false) // 8:30pm Phoenix, still allowed
    expect(isQuietHoursForZip('23000')).toBe(true)  // 11:30pm Eastern, would have been the violation
  })

  it('blocks early morning in the recipient zone', () => {
    vi.setSystemTime(new Date('2026-08-03T12:30:00Z')) // 5:30am Phoenix, 8:30am Eastern
    expect(isQuietHoursForZip('85381')).toBe(true)
    expect(isQuietHoursForZip('23000')).toBe(false)
  })

  it('gives up the edge hours when the ZIP sits in a split state', () => {
    // 01:30 UTC = 8:30pm Eastern. Confident Eastern ZIPs may still send; a split
    // ZIP guessed as Eastern must not, because it might really be Central... or
    // rather it might be an hour later than we think.
    vi.setSystemTime(new Date('2026-08-03T00:30:00Z')) // 8:30pm Eastern
    expect(isQuietHoursForZip('10001')).toBe(false) // confident Eastern
    expect(isQuietHoursForZip('37901')).toBe(true)  // split state, narrowed to 9am-8pm
  })

  it('treats an unknown ZIP conservatively', () => {
    vi.setSystemTime(new Date('2026-08-04T02:30:00Z')) // 8:30pm Mountain
    expect(isQuietHoursForZip('not-a-zip')).toBe(true) // narrowed window closes at 8pm
  })
})

describe('isQuietHoursEverywhere', () => {
  afterEach(() => vi.useRealTimers())

  it('is false while any US zone is inside the window', () => {
    vi.setSystemTime(new Date('2026-08-03T03:30:00Z')) // 8:30pm Phoenix
    expect(isQuietHoursEverywhere()).toBe(false)
  })

  it('is true in the dead of night across every zone', () => {
    // 11:00 UTC = 4am Phoenix, 7am Eastern, 1am Hawaii — nobody is sendable.
    vi.setSystemTime(new Date('2026-08-03T11:00:00Z'))
    expect(isQuietHoursEverywhere()).toBe(true)
  })
})
