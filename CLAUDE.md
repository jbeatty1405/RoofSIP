@AGENTS.md

## Deployment Readiness Checklist

Before every deploy, all of the following must be green. Use `/verify-deploy` to run this automatically.

### Pre-flight
- [ ] All required env vars present
- [ ] No whitespace corruption in `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `TWILIO_AUTH_TOKEN`
- [ ] Stripe key is LIVE mode (cutover completed 2026-05-27; RoofSIP LLC formed, Chase ••••8195)
- [ ] Supabase URL is `https://bzdkftdaclmrblyhoweo.supabase.co`
- [ ] `npx tsc --noEmit` exits clean

### Tests
- [ ] `npm test` (Vitest unit) — all pass
- [ ] `npm run test:e2e` (Playwright E2E) — all pass or explicitly skipped
- [ ] `.last-test-run` file exists and contains `PASSED`

### Deploy
- [ ] `git push origin main` succeeded
- [ ] Vercel build completed without errors
- [ ] `curl https://roof-sip.vercel.app/` returns 200
- [ ] `curl https://roof-sip.vercel.app/login` returns 200

### Post-deploy smoke
- [ ] Login page renders
- [ ] Dashboard accessible after login
- [ ] `/api/stripe/webhook` reachable (POST → 400, not 404)
- [ ] `/api/twilio/webhook` reachable (POST → non-404)

## Test Structure

```
tests/
  e2e/
    auth.spec.ts         — login, signup, redirects
    dashboard.spec.ts    — authenticated dashboard, stats, nav, logout
    homeowners.spec.ts   — add homeowner form, TCPA consent page
    stripe.spec.ts       — subscription status, checkout, API auth guards
  unit/
    stripe-webhook.test.ts  — checkout.session.completed, subscription events
    homeowners.test.ts      — validation, rate limit, quiet hours, Twilio mock
playwright.config.ts    — baseURL from TEST_BASE_URL
vitest.config.ts        — node environment, covers app/api/** and app/_lib/**
```

## Test env vars needed

```
TEST_BASE_URL=https://roof-sip.vercel.app  # or http://localhost:3000
TEST_USER_EMAIL=<confirmed user email>
TEST_USER_PASSWORD=<password>
```

## Security audit status (2026-05-02)

28/30 items complete as of 2026-05-05. Remaining (needs Supabase SQL):
- `#19` Google OAuth tokens unencrypted in profiles — needs pgcrypto + code changes at read/write points
- `#23` SMS cap read-modify-write race — needs Supabase RPC: `CREATE FUNCTION increment_sms_count(p_id uuid) ...`
- `#13` pending_bookings upsert — code already updated; needs SQL: `ALTER TABLE pending_bookings ADD CONSTRAINT pending_bookings_homeowner_id_unique UNIQUE (homeowner_id);`
Full list: `~/.claude/projects/-Users-justinbeatty/memory/roofsip_audit_2026_05_02.md`

## Critical notes

- Stripe is in LIVE mode as of 2026-05-27 — use `sk_live_` / `pk_live_` keys and price `price_1TbmgoGzvPAhHu2dEL9RfwjV`
- Whitespace corruption in Supabase URL breaks SSR auth — add `.replace(/\s/g, '')` to URL reads
- Do NOT use the Jax Liens Stripe account (`acct_1TP7eZAjpHsIP1jP`) for RoofSIP
