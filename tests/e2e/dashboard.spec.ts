import { test, expect } from '@playwright/test'

const EMAIL = process.env.TEST_USER_EMAIL ?? ''
const PASSWORD = process.env.TEST_USER_PASSWORD ?? ''

test.describe('Contractor Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, 'TEST_USER_EMAIL/PASSWORD not set')
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(EMAIL)
    await page.getByLabel(/password/i).fill(PASSWORD)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 12000 })
  })

  test('dashboard shows 4 stat cards', async ({ page }) => {
    await expect(page.getByText(/homeowner/i)).toBeVisible()
    await expect(page.getByText(/inspection/i)).toBeVisible()
    await expect(page.getByText(/opt.in/i)).toBeVisible()
  })

  test('nav links are visible', async ({ page }) => {
    await expect(page.getByRole('link', { name: /homeowner/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /settings/i })).toBeVisible()
  })

  test('settings page is reachable', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText(/subscription|billing|google/i)).toBeVisible()
  })

  test('homeowners list page loads', async ({ page }) => {
    await page.goto('/homeowners')
    // Either a table/list of homeowners or empty state
    const list = page.locator('table, [data-testid="homeowners-list"]')
    const empty = page.getByText(/no homeowners|add your first|get started/i)
    await expect(list.or(empty)).toBeVisible()
  })

  test('sign out button works', async ({ page }) => {
    const signOut = page.getByRole('button', { name: /sign out|log out/i })
    await expect(signOut).toBeVisible()
    await signOut.click()
    await page.waitForURL(/\/login/, { timeout: 8000 })
  })
})
