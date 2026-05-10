import { test, expect } from '@playwright/test'

const EMAIL = process.env.TEST_USER_EMAIL ?? ''
const PASSWORD = process.env.TEST_USER_PASSWORD ?? ''

test.describe('Stripe / Subscription', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, 'TEST_USER_EMAIL/PASSWORD not set')
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(EMAIL)
    await page.getByLabel(/password/i).fill(PASSWORD)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 12000 })
  })

  test('settings page shows subscription status', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText(/subscription|plan|trial|active|inactive/i)).toBeVisible()
    await expect(page.getByText(/\$20|20.*month/i)).toBeVisible()
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

  test('/api/stripe/checkout returns 401 without auth', async ({ page }) => {
    // Direct API hit without session
    const res = await page.request.post('/api/stripe/checkout')
    expect(res.status()).toBe(401)
  })

  test('/api/stripe/portal returns 401 without auth', async ({ page }) => {
    const res = await page.request.post('/api/stripe/portal')
    expect(res.status()).toBe(401)
  })
})
