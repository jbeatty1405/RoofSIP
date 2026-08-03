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
const mockMaybeSingle = vi.fn()
const mockUpsert = vi.fn()
const mockInsert = vi.fn()
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
  mockMaybeSingle.mockResolvedValue({ data: null, error: null })
  mockUpsert.mockResolvedValue({ error: null })
  mockInsert.mockResolvedValue({ error: null })
  mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle, maybeSingle: mockMaybeSingle })
  // .eq() can be followed by .select()/.single()/.maybeSingle()/.eq() so the
  // select…eq…single, update…eq…select…single, and select…eq…maybeSingle chains
  // (the last used by the billing ledger + churn snapshot) all resolve.
  mockEq.mockReturnValue({ select: mockSelect, single: mockSingle, maybeSingle: mockMaybeSingle, eq: mockEq })
  mockUpdate.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate, upsert: mockUpsert, insert: mockInsert })
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
    expect(mockUpdate).toHaveBeenCalledWith({ subscription_status: 'inactive', billing_state: 'canceled' })
  })

  it('handles customer.subscription.deleted — writes a canceled ledger row', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_cancel',
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_dead', status: 'canceled', customer: 'cus_dead' } },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(mockFrom).toHaveBeenCalledWith('billing_events')
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'canceled',
        stripe_event_id: 'evt_cancel',
        stripe_subscription_id: 'sub_dead',
      }),
      expect.objectContaining({ onConflict: 'stripe_event_id' }),
    )
  })

  it('handles invoice.payment_failed — writes a payment_failed ledger row', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_fail',
      type: 'invoice.payment_failed',
      data: { object: { subscription: 'sub_x', customer: 'cus_x', amount_due: 2000 } },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'payment_failed', amount_cents: 2000 }),
      expect.anything(),
    )
  })

  it('handles customer.subscription.updated — active status', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_upd', status: 'active' } },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({ subscription_status: 'active', billing_state: 'active' })
  })

  // A declined card must NOT switch the product off. Stripe retries for 2 weeks;
  // cutting storm monitoring on attempt 1 took a paying customer offline.
  it('handles customer.subscription.updated — past_due KEEPS access, flags billing', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_upd', status: 'past_due' } },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({ subscription_status: 'active', billing_state: 'past_due' })
  })

  // Once Stripe gives up retrying, access genuinely ends.
  it('handles customer.subscription.updated — unpaid ends access', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_upd', status: 'unpaid' } },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({ subscription_status: 'inactive', billing_state: 'canceled' })
  })

  // Newer Stripe API versions nest the subscription under parent.subscription_details.
  it('resolves the subscription id from parent.subscription_details on a failed invoice', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'invoice.payment_failed',
      id: 'evt_pf_nested',
      data: {
        object: {
          customer: 'cus_x',
          amount_due: 2000,
          parent: { subscription_details: { subscription: 'sub_nested' } },
        },
      },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({ billing_state: 'past_due' })
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ stripe_subscription_id: 'sub_nested' }),
      expect.anything(),
    )
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
