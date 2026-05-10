# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Auth >> login page renders
- Location: tests/e2e/auth.spec.ts:7:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByLabel(/email/i)
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByLabel(/email/i)

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - img [ref=e5]
        - generic [ref=e8]: RoofSIP
      - generic [ref=e9]:
        - heading "Your AI roofing assistant is ready." [level=2] [ref=e10]:
          - text: Your AI roofing
          - text: assistant is ready.
        - generic [ref=e11]:
          - generic [ref=e12]:
            - img [ref=e14]
            - paragraph [ref=e16]: Monitors storms 24/7 across all your markets
          - generic [ref=e17]:
            - img [ref=e19]
            - paragraph [ref=e21]: Texts homeowners automatically after weather events
          - generic [ref=e22]:
            - img [ref=e24]
            - paragraph [ref=e26]: Emails you to confirm inspections — no app switching
      - paragraph [ref=e27]: © 2025 RoofSIP
    - generic [ref=e29]:
      - generic [ref=e30]:
        - heading "Sign in" [level=1] [ref=e31]
        - paragraph [ref=e32]: Welcome back
      - generic [ref=e33]:
        - generic [ref=e34]:
          - generic [ref=e35]: Email
          - textbox [ref=e36]
        - generic [ref=e37]:
          - generic [ref=e38]: Password
          - textbox [ref=e39]
        - button "Sign in" [ref=e40]
      - paragraph [ref=e41]:
        - text: No account?
        - link "Sign up free" [ref=e42] [cursor=pointer]:
          - /url: /signup
  - alert [ref=e43]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | const EMAIL = process.env.TEST_USER_EMAIL ?? ''
  4  | const PASSWORD = process.env.TEST_USER_PASSWORD ?? ''
  5  | 
  6  | test.describe('Auth', () => {
  7  |   test('login page renders', async ({ page }) => {
  8  |     await page.goto('/login')
> 9  |     await expect(page.getByLabel(/email/i)).toBeVisible()
     |                                             ^ Error: expect(locator).toBeVisible() failed
  10 |     await expect(page.getByLabel(/password/i)).toBeVisible()
  11 |     await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible()
  12 |   })
  13 | 
  14 |   test('signup page renders', async ({ page }) => {
  15 |     await page.goto('/signup')
  16 |     await expect(page.getByLabel(/email/i)).toBeVisible()
  17 |     await expect(page.getByLabel(/password/i)).toBeVisible()
  18 |     await expect(page.getByLabel(/name/i)).toBeVisible()
  19 |   })
  20 | 
  21 |   test('invalid login shows error', async ({ page }) => {
  22 |     await page.goto('/login')
  23 |     await page.getByLabel(/email/i).fill('nobody@example.com')
  24 |     await page.getByLabel(/password/i).fill('wrongpassword')
  25 |     await page.getByRole('button', { name: /sign in|log in/i }).click()
  26 |     await expect(page.getByText(/invalid|incorrect|not found/i)).toBeVisible({ timeout: 8000 })
  27 |   })
  28 | 
  29 |   test('valid login reaches dashboard', async ({ page }) => {
  30 |     test.skip(!EMAIL || !PASSWORD, 'TEST_USER_EMAIL/PASSWORD not set')
  31 |     await page.goto('/login')
  32 |     await page.getByLabel(/email/i).fill(EMAIL)
  33 |     await page.getByLabel(/password/i).fill(PASSWORD)
  34 |     await page.getByRole('button', { name: /sign in|log in/i }).click()
  35 |     await page.waitForURL(/\/dashboard/, { timeout: 12000 })
  36 |     await expect(page.getByText(/dashboard|homeowner|inspection/i)).toBeVisible()
  37 |   })
  38 | 
  39 |   test('unauthenticated dashboard redirects to login', async ({ page }) => {
  40 |     await page.goto('/dashboard')
  41 |     await page.waitForURL(/\/login/, { timeout: 8000 })
  42 |   })
  43 | 
  44 |   test('unauthenticated homeowners page redirects to login', async ({ page }) => {
  45 |     await page.goto('/homeowners')
  46 |     await page.waitForURL(/\/login/, { timeout: 8000 })
  47 |   })
  48 | })
  49 | 
```