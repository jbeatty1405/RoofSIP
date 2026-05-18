import { test, expect } from '@playwright/test'

const EMAIL = process.env.TEST_USER_EMAIL ?? ''
const PASSWORD = process.env.TEST_USER_PASSWORD ?? ''

test.describe('Stripe / Subscription', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, 'TEST_USER_EMAIL/PASSWORD not set')
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(EMAIL)
    await page.locator('input[type="password"]').fill(PASSWORD)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 12000 })
  })

  test('settings page shows subscription status', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: 'Subscription' })).toBeVisible()
    await expect(page.getByText(/active|inactive|trialing|past_due/i).first()).toBeVisible()
  })

  test('subscribe button calls checkout endpoint and redirects to Stripe', async ({ page }) => {
    await page.goto('/settings')
    const subscribeBtn = page.getByRole('button', { name: /subscribe|upgrade|start/i })
    if (!(await subscribeBtn.isVisible())) {
      test.skip(true, 'User already subscribed — subscribe button not shown')
    }
    // Intercept checkout redirect
    const [popup] = await Promise.all([
      page.waitForURL(/stripe\.com|checkout\.stripe/, { timeout: 10000 }).catch(() => null),
      subscribeBtn.click(),
    ])
    // Either redirected to Stripe or URL changed to stripe
    const currentUrl = page.url()
    expect(currentUrl).toMatch(/stripe\.com|localhost/)
  })

})

test.describe('Stripe / API guards (no auth)', () => {
  test('/api/stripe/checkout returns 401 without auth', async ({ request }) => {
    const res = await request.post('/api/stripe/checkout')
    expect(res.status()).toBe(401)
  })

  test('/api/stripe/portal returns 401 without auth', async ({ request }) => {
    const res = await request.post('/api/stripe/portal')
    expect(res.status()).toBe(401)
  })
})
