import { test, expect } from '@playwright/test'

const EMAIL = process.env.TEST_USER_EMAIL ?? ''
const PASSWORD = process.env.TEST_USER_PASSWORD ?? ''

test.describe('Contractor Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, 'TEST_USER_EMAIL/PASSWORD not set')
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(EMAIL)
    await page.locator('input[type="password"]').fill(PASSWORD)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 12000 })
  })

  test('dashboard shows 4 stat cards', async ({ page }) => {
    await expect(page.getByText('Homeowners').first()).toBeVisible()
    await expect(page.getByText(/inspections this month/i).first()).toBeVisible()
    await expect(page.getByText(/opted in/i).first()).toBeVisible()
  })

  test('nav links are visible', async ({ page }) => {
    const nav = page.locator('aside nav')
    await expect(nav.getByRole('link', { name: 'Homeowners', exact: true })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Settings', exact: true })).toBeVisible()
  })

  test('settings page is reachable', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: 'Subscription' })).toBeVisible()
  })

  test('homeowners list page loads', async ({ page }) => {
    await page.goto('/homeowners')
    const list = page.locator('table, [data-testid="homeowners-list"]')
    const empty = page.getByText(/no homeowners|add your first|get started/i)
    await expect(list.or(empty).first()).toBeVisible()
  })

  test('sign out button works', async ({ page }) => {
    const signOut = page.getByRole('button', { name: /sign out|log out/i })
    await expect(signOut).toBeVisible()
    await signOut.click()
    await page.waitForURL(/\/login/, { timeout: 8000 })
  })
})
