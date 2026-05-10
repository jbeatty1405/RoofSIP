import { test, expect } from '@playwright/test'

const EMAIL = process.env.TEST_USER_EMAIL ?? ''
const PASSWORD = process.env.TEST_USER_PASSWORD ?? ''

// RoofSIP labels have no htmlFor — use type selectors
const emailInput = 'input[type="email"]'
const passwordInput = 'input[type="password"]'

test.describe('Auth', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('Sign in')).toBeVisible()
    await expect(page.locator(emailInput)).toBeVisible()
    await expect(page.locator(passwordInput)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  test('signup page renders', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.locator(emailInput)).toBeVisible()
    await expect(page.locator(passwordInput)).toBeVisible()
  })

  test('invalid login shows error', async ({ page }) => {
    await page.goto('/login')
    await page.locator(emailInput).fill('nobody@example.com')
    await page.locator(passwordInput).fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText(/invalid|incorrect|not found|wrong/i)).toBeVisible({ timeout: 8000 })
  })

  test('valid login reaches dashboard', async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, 'TEST_USER_EMAIL/PASSWORD not set')
    await page.goto('/login')
    await page.locator(emailInput).fill(EMAIL)
    await page.locator(passwordInput).fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 12000 })
  })

  test('unauthenticated dashboard redirects to login', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL(/\/login/, { timeout: 8000 })
  })

  test('unauthenticated homeowners page redirects to login', async ({ page }) => {
    await page.goto('/homeowners')
    await page.waitForURL(/\/login/, { timeout: 8000 })
  })
})
