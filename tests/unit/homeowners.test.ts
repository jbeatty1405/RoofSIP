import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock all external dependencies
const mockGetUser = vi.fn()
const mockFrom = vi.fn()
const mockInsert = vi.fn()
const mockSelect = vi.fn()
const mockSingle = vi.fn()
const mockEq = vi.fn()

vi.mock('@/app/_lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
  createServiceClient: vi.fn().mockResolvedValue({
    from: mockFrom,
    auth: { admin: {} },
  }),
}))

const mockTwilioCreate = vi.fn()
vi.mock('@/app/_lib/twilio', () => ({
  getTwilioClient: vi.fn(() => ({
    messages: { create: mockTwilioCreate },
  })),
  buildIntroSms: vi.fn().mockReturnValue('Test intro SMS'),
  isMonthlySmsCapped: vi.fn().mockResolvedValue(false),
}))

vi.mock('@/app/_lib/schedule', () => ({
  isQuietHours: vi.fn().mockReturnValue(false),
}))

vi.mock('@/app/_lib/rate-limit', () => ({
  homeownerCreatesLast24h: vi.fn().mockResolvedValue(0),
  HOMEOWNER_DAILY_LIMIT: 50,
}))

beforeEach(() => {
  vi.clearAllMocks()
  process.env.TWILIO_PHONE_NUMBER = '+18775024593'

  // Default: authenticated confirmed user
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'user_1', email_confirmed_at: new Date().toISOString() } },
  })

  // Chain: from().insert().select().single()
  mockSingle.mockResolvedValue({ data: { id: 'hw_new', name: 'Jane Doe' }, error: null })
  mockSelect.mockReturnValue({ single: mockSingle })
  mockInsert.mockReturnValue({ select: mockSelect })
  mockEq.mockReturnValue({ single: mockSingle })
  mockFrom.mockReturnValue({ insert: mockInsert, select: () => ({ eq: mockEq }) })

  mockTwilioCreate.mockResolvedValue({ sid: 'SM_test' })
})

const { POST } = await import('@/app/api/homeowners/route')

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/homeowners', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/homeowners', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest({ name: 'Jane', phone: '6025551234', address: '1 Main', zipCode: '85001' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when email not confirmed', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user_1', email_confirmed_at: null } },
    })
    const res = await POST(makeRequest({ name: 'Jane', phone: '6025551234', address: '1 Main', zipCode: '85001' }))
    expect(res.status).toBe(403)
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeRequest({ phone: '6025551234', address: '1 Main', zipCode: '85001' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/name/i)
  })

  it('returns 400 for invalid ZIP code', async () => {
    const res = await POST(makeRequest({ name: 'Jane', phone: '6025551234', address: '1 Main', zipCode: 'ABCDE' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/zip/i)
  })

  it('returns 400 for invalid phone number', async () => {
    const res = await POST(makeRequest({ name: 'Jane', phone: '123', address: '1 Main', zipCode: '85001' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/phone/i)
  })

  it('creates homeowner and sends opt-in SMS for valid input', async () => {
    const res = await POST(makeRequest({
      name: 'Jane Doe',
      phone: '6025551234',
      address: '123 Main St',
      zipCode: '85001',
      photoUrls: [],
      tcpaConsent: true,
    }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.id).toBe('hw_new')
    expect(mockTwilioCreate).toHaveBeenCalledOnce()
    expect(mockTwilioCreate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '+16025551234' })
    )
  })

  it('accepts 11-digit phone with leading 1', async () => {
    const res = await POST(makeRequest({
      name: 'Bob Smith',
      phone: '16025551234',
      address: '456 Oak Ave',
      zipCode: '85001',
      tcpaConsent: true,
    }))
    expect(res.status).toBe(200)
    expect(mockTwilioCreate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '+16025551234' })
    )
  })

  it('returns 429 when daily limit reached', async () => {
    const { homeownerCreatesLast24h } = await import('@/app/_lib/rate-limit')
    vi.mocked(homeownerCreatesLast24h).mockResolvedValue(50)
    const res = await POST(makeRequest({
      name: 'Jane Doe',
      phone: '6025551234',
      address: '123 Main St',
      zipCode: '85001',
    }))
    expect(res.status).toBe(429)
  })

  it('returns deferred=true during quiet hours (no SMS sent)', async () => {
    const { isQuietHours } = await import('@/app/_lib/schedule')
    const { homeownerCreatesLast24h } = await import('@/app/_lib/rate-limit')
    vi.mocked(homeownerCreatesLast24h).mockResolvedValue(0) // reset from rate-limit test
    vi.mocked(isQuietHours).mockReturnValue(true)
    const res = await POST(makeRequest({
      name: 'Jane Doe',
      phone: '6025551234',
      address: '123 Main St',
      zipCode: '85001',
      tcpaConsent: true,
    }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.deferred).toBe(true)
    expect(mockTwilioCreate).not.toHaveBeenCalled()
  })

  it('returns 400 for photo URL exceeding max length', async () => {
    const res = await POST(makeRequest({
      name: 'Jane',
      phone: '6025551234',
      address: '1 Main',
      zipCode: '85001',
      photoUrls: ['http://' + 'a'.repeat(500)],
    }))
    expect(res.status).toBe(400)
  })
})
