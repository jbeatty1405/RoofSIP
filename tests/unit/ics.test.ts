import { describe, it, expect } from 'vitest'
import { googleCalendarUrl, buildInspectionIcs } from '@/app/_lib/ics'

const appt = { startISO: '2026-11-03T17:00:00.000Z', homeownerName: 'Pat Lee', homeownerAddress: '123 Main St, Mesa AZ', homeownerPhone: '4805550100' }

describe('googleCalendarUrl', () => {
  it('prefills a 1-hour event at the booked time', () => {
    const url = new URL(googleCalendarUrl(appt)!)
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('dates')).toBe('20261103T170000Z/20261103T180000Z')
    expect(url.searchParams.get('location')).toBe('123 Main St, Mesa AZ')
    expect(url.searchParams.get('text')).toContain('Pat Lee')
    expect(url.searchParams.get('details')).toContain('4805550100')
  })

  it('matches the .ics times', () => {
    const ics = buildInspectionIcs(appt)!
    expect(ics).toContain('DTSTART:20261103T170000Z')
    expect(ics).toContain('DTEND:20261103T180000Z')
  })

  it('is null for a bad time', () => {
    expect(googleCalendarUrl({ ...appt, startISO: 'nope' })).toBeNull()
  })
})
