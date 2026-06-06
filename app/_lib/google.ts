import { google } from 'googleapis'
import { APP_URL } from './url'

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${APP_URL}/api/google/callback`
  )
}

export async function getAvailableSlots({
  accessToken,
  refreshToken,
  calendarId,
  workingDays = [1, 2, 3, 4, 5],
  workingStart = '08:00',
  workingEnd = '17:00',
  count = 3,
}: {
  accessToken: string
  refreshToken: string
  calendarId: string
  workingDays?: number[]
  workingStart?: string
  workingEnd?: string
  count?: number
}): Promise<Date[]> {
  const oauth2Client = getOAuthClient()
  oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken })
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

  const now = new Date()
  const lookAhead = new Date(now)
  lookAhead.setDate(lookAhead.getDate() + 14)

  const eventsRes = await calendar.events.list({
    calendarId,
    timeMin: now.toISOString(),
    timeMax: lookAhead.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  })

  const busy = (eventsRes.data.items ?? [])
    .filter(e => e.start?.dateTime && e.end?.dateTime)
    .map(e => ({ start: new Date(e.start!.dateTime!), end: new Date(e.end!.dateTime!) }))

  const [startH, startM] = workingStart.split(':').map(Number)
  const [endH, endM] = workingEnd.split(':').map(Number)

  const slots: Date[] = []
  const cursor = new Date(now)
  cursor.setMinutes(0, 0, 0)
  cursor.setHours(cursor.getHours() + 1)

  while (slots.length < count && cursor < lookAhead) {
    const day = cursor.getDay()

    if (!workingDays.includes(day)) {
      cursor.setDate(cursor.getDate() + 1)
      cursor.setHours(startH, startM, 0, 0)
      continue
    }

    const dayStart = new Date(cursor)
    dayStart.setHours(startH, startM, 0, 0)
    const dayEnd = new Date(cursor)
    dayEnd.setHours(endH, endM, 0, 0)

    if (cursor < dayStart) cursor.setTime(dayStart.getTime())

    if (cursor >= dayEnd) {
      cursor.setDate(cursor.getDate() + 1)
      cursor.setHours(startH, startM, 0, 0)
      continue
    }

    const slotEnd = new Date(cursor.getTime() + 60 * 60 * 1000)
    if (slotEnd > dayEnd) {
      cursor.setDate(cursor.getDate() + 1)
      cursor.setHours(startH, startM, 0, 0)
      continue
    }

    const conflict = busy.find(b => cursor < b.end && slotEnd > b.start)
    if (!conflict) slots.push(new Date(cursor))

    cursor.setHours(cursor.getHours() + 1)
  }

  return slots
}

export function getGoogleAuthUrl(state: string): string {
  const oauth2Client = getOAuthClient()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state,
  })
}

export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = getOAuthClient()
  const { tokens } = await oauth2Client.getToken(code)
  return tokens
}

export async function addCalendarEvent({
  accessToken,
  refreshToken,
  calendarId,
  summary,
  description,
  startTime,
  durationMinutes,
}: {
  accessToken: string
  refreshToken: string
  calendarId: string
  summary: string
  description: string
  startTime: Date
  durationMinutes: number
}): Promise<string> {
  const oauth2Client = getOAuthClient()
  oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken })

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000)

  const event = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary,
      description,
      start: { dateTime: startTime.toISOString() },
      end: { dateTime: endTime.toISOString() },
    },
  })

  return event.data.id!
}
