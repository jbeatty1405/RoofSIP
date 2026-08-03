import { describe, it, expect, vi, beforeEach } from 'vitest'

// The 60 free days must be a first-time offer. Cancelling and re-subscribing used
// to grant another full trial, which the "Restart subscription" button leads into.
const mockList = vi.fn()
const mockSessionCreate = vi.fn(async (_args: any) => ({ url: 'https://checkout.test/session' }))

vi.mock('stripe', () => ({
  default: class {
    subscriptions = { list: mockList }
    checkout = { sessions: { create: mockSessionCreate } }
  },
}))

const { createCheckoutSession, hasHadTrial } = await import('@/app/_lib/stripe')

beforeEach(() => {
  mockList.mockReset()
  mockSessionCreate.mockClear()
  mockSessionCreate.mockResolvedValue({ url: 'https://checkout.test/session' })
})

describe('trial eligibility', () => {
  it('grants the trial to a brand new customer', async () => {
    mockList.mockResolvedValue({ data: [] })

    expect(await hasHadTrial('cus_new')).toBe(false)

    await createCheckoutSession('cus_new', 'user_1', 'https://app.test')
    const arg = mockSessionCreate.mock.calls[0][0] as any
    expect(arg.subscription_data).toEqual({ trial_period_days: 60 })
    expect(arg.custom_text.submit.message).toContain('60-day free trial')
  })

  it('withholds the trial from a customer who already used one', async () => {
    mockList.mockResolvedValue({ data: [{ status: 'canceled', trial_start: 1700000000 }] })

    expect(await hasHadTrial('cus_returning')).toBe(true)

    await createCheckoutSession('cus_returning', 'user_2', 'https://app.test')
    const arg = mockSessionCreate.mock.calls[0][0] as any
    expect(arg.subscription_data).toBeUndefined()
  })

  it('tells a returning customer they are charged today, not trialed', async () => {
    mockList.mockResolvedValue({ data: [{ status: 'canceled', trial_start: 1700000000 }] })

    await createCheckoutSession('cus_returning', 'user_2', 'https://app.test')
    const arg = mockSessionCreate.mock.calls[0][0] as any
    expect(arg.custom_text.submit.message).toContain('charged $20 today')
    expect(arg.custom_text.submit.message).not.toContain('free trial')
  })

  it('still grants the trial when a prior sub never had one', async () => {
    mockList.mockResolvedValue({ data: [{ status: 'canceled', trial_start: null }] })

    expect(await hasHadTrial('cus_no_trial')).toBe(false)

    await createCheckoutSession('cus_no_trial', 'user_3', 'https://app.test')
    const arg = mockSessionCreate.mock.calls[0][0] as any
    expect(arg.subscription_data).toEqual({ trial_period_days: 60 })
  })
})
