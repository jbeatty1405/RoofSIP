import { test, expect } from '@playwright/test'

const EMAIL = process.env.TEST_USER_EMAIL ?? ''
const PASSWORD = process.env.TEST_USER_PASSWORD ?? ''

test.describe('Homeowners / SMS Opt-in', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, 'TEST_USER_EMAIL/PASSWORD not set')
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(EMAIL)
    await page.locator('input[type="password"]').fill(PASSWORD)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 12000 })
  })

  test('add homeowner form renders required fields', async ({ page }) => {
    await page.goto('/homeowners/new')
    await expect(page.locator('#ho-name')).toBeVisible()
    await expect(page.locator('#ho-phone')).toBeVisible()
    await expect(page.locator('#ho-address')).toBeVisible()
    await expect(page.locator('#ho-zip')).toBeVisible()
  })

  test('add homeowner form requires all fields', async ({ page }) => {
    await page.goto('/homeowners/new')
    await page.getByRole('button', { name: /add|save|submit/i }).click()
    // Should show validation errors, not redirect
    await expect(page).toHaveURL(/\/homeowners\/new/, { timeout: 3000 })
  })

  test('consent page is publicly accessible', async ({ page }) => {
    await page.goto('/consent')
    await expect(page.getByRole('heading', { name: /sms opt-in/i })).toBeVisible()
    await expect(page.getByText(/stop|opt out|unsubscribe/i).first()).toBeVisible()
  })

  test('add homeowner with invalid phone shows error', async ({ page }) => {
    await page.goto('/homeowners/new')
    await page.locator('#ho-name').fill('Test Homeowner')
    await page.locator('#ho-phone').fill('123')
    await page.locator('#ho-address').fill('123 Test St')
    await page.locator('#ho-zip').fill('85001')
    await page.getByRole('button', { name: /add|save|submit/i }).click()
    await expect(page.getByText(/phone|invalid/i).first()).toBeVisible({ timeout: 5000 })
  })
})
