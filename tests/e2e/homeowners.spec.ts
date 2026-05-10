import { test, expect } from '@playwright/test'

const EMAIL = process.env.TEST_USER_EMAIL ?? ''
const PASSWORD = process.env.TEST_USER_PASSWORD ?? ''

test.describe('Homeowners / SMS Opt-in', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, 'TEST_USER_EMAIL/PASSWORD not set')
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(EMAIL)
    await page.getByLabel(/password/i).fill(PASSWORD)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 12000 })
  })

  test('add homeowner form renders required fields', async ({ page }) => {
    await page.goto('/homeowners/new')
    await expect(page.getByLabel(/name/i)).toBeVisible()
    await expect(page.getByLabel(/phone/i)).toBeVisible()
    await expect(page.getByLabel(/address/i)).toBeVisible()
    await expect(page.getByLabel(/zip/i)).toBeVisible()
  })

  test('add homeowner form requires all fields', async ({ page }) => {
    await page.goto('/homeowners/new')
    await page.getByRole('button', { name: /add|save|submit/i }).click()
    // Should show validation errors, not redirect
    await expect(page).toHaveURL(/\/homeowners\/new/, { timeout: 3000 })
  })

  test('consent page is publicly accessible', async ({ page }) => {
    await page.goto('/consent')
    await expect(page.getByText(/tcpa|opt.in|sms|storm|alert/i)).toBeVisible()
    await expect(page.getByText(/stop|opt out|unsubscribe/i)).toBeVisible()
  })

  test('add homeowner with invalid phone shows error', async ({ page }) => {
    await page.goto('/homeowners/new')
    await page.getByLabel(/name/i).fill('Test Homeowner')
    await page.getByLabel(/phone/i).fill('123')
    await page.getByLabel(/address/i).fill('123 Test St')
    await page.getByLabel(/zip/i).fill('85001')
    await page.getByRole('button', { name: /add|save|submit/i }).click()
    await expect(page.getByText(/phone|invalid/i)).toBeVisible({ timeout: 5000 })
  })
})
