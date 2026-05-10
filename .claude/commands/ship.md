# /ship — Autonomous Deploy-Verify Loop (RoofSIP)

Run an autonomous deploy-verify loop for the RoofSIP app. Max 5 iterations. Only promote to production when every check passes.

If the user passes `--dry-run`, skip the actual Vercel deploy and production promotion — report what *would* happen based on tests and typecheck only.

---

## Loop (repeat up to 5 times until all checks pass)

### Step 1 — Typecheck + Unit Tests
```
npx tsc --noEmit
npm run test
```
If either fails: read the error, patch the code, increment iteration counter, restart from Step 1. Do not proceed to Step 2 with a failing typecheck or failing unit tests.

### Step 2 — Deploy to Vercel Preview
```
vercel deploy --yes
```
Capture the preview URL from stdout (looks like `https://roofsip-<hash>.vercel.app`).

If `--dry-run` was passed, skip this step and use `https://roof-sip.vercel.app` as the URL for the remaining steps (for reference only — do not actually run E2E against production in dry-run).

If the deploy fails: read the build logs (`vercel logs <deployment-url> --output raw`), diagnose, patch, restart from Step 1.

### Step 3 — Playwright E2E Against Preview URL
Set `PLAYWRIGHT_BASE_URL` to the preview URL, then run:
```
PLAYWRIGHT_BASE_URL=<preview-url> npm run test:e2e
```

E2E suite covers: `auth.spec.ts`, `dashboard.spec.ts`, `homeowners.spec.ts`, `stripe.spec.ts` (signup, SMS opt-in, payment, and storm-alert flows).

If any spec fails:
- Read the Playwright HTML report or trace for the failing test
- Take a screenshot if available
- Diagnose the failure (DOM change? Twilio/Stripe mock? env var missing on preview?)
- Patch the code or test, restart from Step 1

### Step 4 — Tail Runtime Logs
```
vercel logs <preview-url> --output raw --limit 100
```
Scan for: `Error`, `TypeError`, `500`, `Unhandled`, `FATAL`, `TwilioRestException`. If found, diagnose and patch, restart from Step 1.

### Step 5 — All Checks Pass → Promote to Production
Once Step 1–4 all pass in the same iteration:
```
vercel promote <deployment-url> --yes
```
Then confirm production is live:
```
curl -sf https://roof-sip.vercel.app/api/health || curl -I https://roof-sip.vercel.app
```

---

## Summary (always post at the end)

```
## /ship summary — RoofSIP
- Iterations: X/5
- Typecheck: pass/fail
- Unit tests: X passed, Y failed
- E2E: X passed, Y failed (list failing specs if any)
- Runtime log errors: none / (list)
- Auto-fixes applied: (list files changed + one-line description each, or "none")
- Preview URL: https://...
- Production: promoted ✓ / NOT promoted (reason)
```

If the loop exhausts all 5 iterations without a clean pass, stop and report exactly where it's stuck — do not promote to production.
