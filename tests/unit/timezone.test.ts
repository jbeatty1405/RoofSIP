import { describe, it, expect, afterEach, vi } from 'vitest'
import { zipTimezone, stateTimezone, rooferTimezone, timezoneFromZips, toWallClock, fromWallClock, hourIn } from '@/app/_lib/timezone'
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
  // The old version of this suite passed `{ billing_state: 'AZ' }` and went green
  // for months. Production never holds a state code in that column — it is the
  // Stripe status — so the test proved the resolver worked on an input the app
  // could not supply. Everything here uses shapes the app actually produces.
  it('resolves from the homeowner ZIP being scheduled', () => {
    expect(rooferTimezone({}, '85614')).toBe('America/Phoenix')
    expect(rooferTimezone({}, '75001')).toBe('America/Chicago')
    expect(rooferTimezone({}, '90210')).toBe('America/Los_Angeles')
  })

  it('honors an explicit per-roofer zone over the ZIP', () => {
    expect(rooferTimezone({ timezone: 'America/New_York' }, '85614')).toBe('America/New_York')
  })

  it('ignores an unrecognized explicit zone instead of throwing inside Intl', () => {
    expect(rooferTimezone({ timezone: 'Mars/Olympus' }, '85614')).toBe('America/Phoenix')
  })

  it('never reads a Stripe billing status as a location', () => {
    // Every value the Stripe webhook writes, against an Arizona ZIP.
    for (const status of ['active', 'past_due', 'canceled']) {
      expect(rooferTimezone({ billing_state: status } as any, '85614')).toBe('America/Phoenix')
    }
  })

  it('falls back rather than throwing when nothing is known', () => {
    expect(rooferTimezone(null)).toBe('America/Denver')
    expect(rooferTimezone({}, null)).toBe('America/Denver')
    expect(stateTimezone('ZZ').confident).toBe(false)
  })
})

describe('timezoneFromZips', () => {
  it('picks one stable zone for a roofer from their whole book', () => {
    expect(timezoneFromZips(['85614', '85710', '86314'])).toBe('America/Phoenix')
    expect(timezoneFromZips(['23606', '23601'])).toBe('America/New_York')
  })

  it('takes the majority zone when a book straddles a line', () => {
    expect(timezoneFromZips(['85614', '85710', '75001'])).toBe('America/Phoenix')
  })

  it('ignores junk ZIPs and falls back on an empty book', () => {
    expect(timezoneFromZips(['', null, undefined, 'ab'])).toBe('America/Denver')
    expect(timezoneFromZips([])).toBe('America/Denver')
    expect(timezoneFromZips([null, '85614'])).toBe('America/Phoenix')
  })
})

describe('the offer text and the confirmation text agree', () => {
  // The live failure on 2026-08-10: John Leong was offered "tomorrow at 8:00 AM"
  // and confirmed into "August 11 at 7:00 AM" for one and the same instant,
  // because the offer formatted in the Denver fallback and the confirmation
  // hardcoded Phoenix. Both sides now resolve through rooferTimezone.
  it('names the same hour on both sides of a Sahuarita booking', () => {
    const slot = new Date('2026-08-11T14:00:00Z')
    const zip = '85614'
    const offerTz = rooferTimezone({}, zip)
    const confirmTz = rooferTimezone({}, zip)
    expect(offerTz).toBe(confirmTz)

    const hour = (tz: string) =>
      slot.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', hour12: true })
    expect(hour(offerTz)).toBe('7 AM')
    expect(hour(confirmTz)).toBe('7 AM')
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
