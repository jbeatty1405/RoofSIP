import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Cookie-auth client (createClient): auth.getUser + profiles select chain
const mockGetUser = vi.fn()
const mockCookieSingle = vi.fn()
const mockCookieEq = vi.fn(() => ({ single: mockCookieSingle }))
const mockCookieSelect = vi.fn(() => ({ eq: mockCookieEq }))
const mockCookieFrom = vi.fn(() => ({ select: mockCookieSelect }))

// Service client (createServiceClient): rate-limit rpc + profiles update chain
const mockRpc = vi.fn()
const mockSvcEq = vi.fn().mockResolvedValue({ error: null })
const mockSvcUpdate = vi.fn(() => ({ eq: mockSvcEq }))
const mockSvcFrom = vi.fn(() => ({ update: mockSvcUpdate }))

vi.mock('@/app/_lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockCookieFrom,
  }),
  createServiceClient: vi.fn().mockResolvedValue({
    rpc: mockRpc,
    from: mockSvcFrom,
  }),
}))

const mockSubsList = vi.fn()
const mockCustomersCreate = vi.fn()
const mockCreateCheckoutSession = vi.fn()

vi.mock('@/app/_lib/stripe', () => ({
  stripe: {
    subscriptions: { list: mockSubsList },
    customers: { create: mockCustomersCreate },
  },
  createCheckoutSession: mockCreateCheckoutSession,
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user_1', email: 'pm@example.com' } } })
  mockRpc.mockResolvedValue({ data: 1, error: null }) // under the 5/hr limit
  mockCookieSingle.mockResolvedValue({ data: { stripe_customer_id: 'cus_1' }, error: null })
  mockSubsList.mockResolvedValue({ data: [] })
  mockCustomersCreate.mockResolvedValue({ id: 'cus_new' })
  mockCreateCheckoutSession.mockResolvedValue('https://checkout.test/session')
})

const { POST } = await import('@/app/api/stripe/checkout/route')

function req(): NextRequest {
  return new NextRequest('http://localhost/api/stripe/checkout', { method: 'POST' })
}

describe('POST /api/stripe/checkout (RoofSIP)', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(req())
    expect(res.status).toBe(401)
  })

  it('blocks a duplicate subscription when a live sub already exists', async () => {
    mockSubsList.mockResolvedValue({ data: [{ status: 'active' }] })
    const res = await POST(req())
    expect(res.status).toBe(400)
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
  })

  it('blocks when the existing sub is trialing', async () => {
    mockSubsList.mockResolvedValue({ data: [{ status: 'trialing' }] })
    const res = await POST(req())
    expect(res.status).toBe(400)
  })

  it('allows checkout when existing subs are all canceled', async () => {
    mockSubsList.mockResolvedValue({ data: [{ status: 'canceled' }] })
    const res = await POST(req())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toBe('https://checkout.test/session')
  })

  it('creates a new customer + session when none exists (no dup check needed)', async () => {
    mockCookieSingle.mockResolvedValue({ data: { stripe_customer_id: null }, error: null })
    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(mockCustomersCreate).toHaveBeenCalled()
    expect(mockSvcUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ stripe_customer_id: 'cus_new' })
    )
    expect(mockSubsList).not.toHaveBeenCalled()
  })

  it('returns 429 when the checkout rate limit is exceeded', async () => {
    mockRpc.mockResolvedValue({ data: 6, error: null }) // over the 5/hr limit
    const res = await POST(req())
    expect(res.status).toBe(429)
  })
})
