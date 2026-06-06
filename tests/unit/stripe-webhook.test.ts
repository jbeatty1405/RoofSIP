import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockConstructEvent = vi.fn()
const mockCustomersRetrieve = vi.fn()

vi.mock('@/app/_lib/stripe', () => ({
  stripe: {
    webhooks: { constructEvent: mockConstructEvent },
    customers: { retrieve: mockCustomersRetrieve },
  },
}))

const mockFrom = vi.fn()
const mockUpdate = vi.fn()
const mockEq = vi.fn()
const mockSelect = vi.fn()
const mockSingle = vi.fn()
const mockGetUserById = vi.fn()

vi.mock('@/app/_lib/supabase/server', () => ({
  createServiceClient: vi.fn().mockResolvedValue({
    from: mockFrom,
    auth: { admin: { getUserById: mockGetUserById } },
  }),
}))

vi.mock('@/app/_lib/email', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  sendTrialEndingEmail: vi.fn().mockResolvedValue(undefined),
}))

beforeEach(() => {
  vi.clearAllMocks()
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'

  mockSingle.mockResolvedValue({ data: null, error: null })
  mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle })
  // .eq() can be followed by .select()/.single()/.eq() so both the
  // select…eq…single and update…eq…select…single chains resolve.
  mockEq.mockReturnValue({ select: mockSelect, single: mockSingle, eq: mockEq })
  mockUpdate.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate })
  mockGetUserById.mockResolvedValue({ data: { user: { email: 'test@example.com' } } })
})

const { POST } = await import('@/app/api/stripe/webhook/route')

function makeRequest(body: string, sig = 'test-sig'): NextRequest {
  return new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': sig },
    body,
  })
}

describe('POST /api/stripe/webhook (RoofSIP)', () => {
  it('returns 400 on bad signature', async () => {
    mockConstructEvent.mockImplementation(() => { throw new Error('bad sig') })
    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(400)
  })

  it('handles checkout.session.completed — activates subscription', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { userId: 'user_abc' },
          customer: 'cus_abc',
          subscription: 'sub_abc',
        },
      },
    })
    mockSingle.mockResolvedValue({
      data: { id: 'user_abc', stripe_customer_id: 'cus_abc' },
      error: null,
    })
    mockGetUserById.mockResolvedValue({ data: { user: { email: 'test@example.com' } } })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ subscription_status: 'active' })
    )
  })

  it('handles customer.subscription.deleted — marks inactive', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_dead', status: 'canceled' } },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({ subscription_status: 'inactive' })
  })

  it('handles customer.subscription.updated — active status', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_upd', status: 'active' } },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({ subscription_status: 'active' })
  })

  it('handles customer.subscription.updated — inactive on past_due', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_upd', status: 'past_due' } },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({ subscription_status: 'inactive' })
  })

  it('returns 200 received for unhandled events', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'customer.created',
      data: { object: {} },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)
  })
})
