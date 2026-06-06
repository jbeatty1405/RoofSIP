// iCalendar (.ics) generation — shared by the confirmation email and the
// /api/calendar download endpoint so the roofer can add an inspection to
// Apple Calendar / Google / Outlook in one tap.

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

function toIcsUtc(d: Date): string {
  // 2026-06-12T16:00:00.000Z -> 20260612T160000Z
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

// Builds a PUBLISH-method VEVENT (a plain "add to my calendar" item, not an RSVP invite).
// Returns null if startISO isn't a valid date.
export function buildInspectionIcs({
  startISO,
  homeownerName,
  homeownerAddress,
  homeownerPhone,
}: {
  startISO: string
  homeownerName: string
  homeownerAddress: string
  homeownerPhone: string
}): string | null {
  const start = new Date(startISO)
  if (isNaN(start.getTime())) return null
  const end = new Date(start.getTime() + 60 * 60 * 1000) // 1-hour slot (matches scheduler)
  const dtStart = toIcsUtc(start)
  const uid = `inspection-${dtStart}-${encodeURIComponent(homeownerName)}@roofsip`
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RoofSIP//Inspection//EN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStart}`,
    `DTSTART:${dtStart}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${icsEscape(`Roof inspection — ${homeownerName}`)}`,
    `LOCATION:${icsEscape(homeownerAddress)}`,
    `DESCRIPTION:${icsEscape(`Free roof inspection for ${homeownerName}. Phone: ${homeownerPhone}. Booked via RoofSIP.`)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Roof inspection reminder',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}
