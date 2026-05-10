#!/usr/bin/env bash
# Pre-flight checks for RoofSIP before deploy
# Exit 1 on any failure.

set -euo pipefail
PASS=0; FAIL=0

check() {
  local label="$1"; local result="$2"
  if [ "$result" = "ok" ]; then
    echo "  ✅ $label"; ((PASS++))
  else
    echo "  ❌ $label: $result"; ((FAIL++))
  fi
}

echo "=== RoofSIP Pre-flight ==="

# 1. Required env vars
REQUIRED_VARS=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  STRIPE_SECRET_KEY
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  STRIPE_WEBHOOK_SECRET
  TWILIO_ACCOUNT_SID
  TWILIO_AUTH_TOKEN
  TWILIO_PHONE_NUMBER
  NEXTAUTH_SECRET
  NEXTAUTH_URL
  ANTHROPIC_API_KEY
)

echo "--- Env vars"
for var in "${REQUIRED_VARS[@]}"; do
  val="${!var:-}"
  if [ -z "$val" ]; then
    check "$var" "MISSING"
  else
    check "$var" "ok"
  fi
done

# 2. Whitespace corruption
echo "--- Whitespace corruption"
WHITESPACE_VARS=(NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET TWILIO_AUTH_TOKEN)
for var in "${WHITESPACE_VARS[@]}"; do
  val="${!var:-}"
  if [ -z "$val" ]; then continue; fi
  trimmed=$(echo "$val" | tr -d '[:space:]')
  if [ "$trimmed" != "$val" ]; then
    check "$var whitespace" "CORRUPTED — strip whitespace"
  else
    check "$var whitespace" "ok"
  fi
done

# 3. Stripe key mode — RoofSIP must stay TEST until LLC formed
echo "--- Stripe key mode"
STRIPE_KEY="${STRIPE_SECRET_KEY:-}"
if echo "$STRIPE_KEY" | grep -q '^sk_live_'; then
  check "Stripe key mode" "⚠️  LIVE KEY — RoofSIP LLC not formed yet; confirm intentional"
elif echo "$STRIPE_KEY" | grep -q '^sk_test_'; then
  check "Stripe key mode" "ok (TEST)"
elif [ -n "$STRIPE_KEY" ]; then
  check "Stripe key mode" "UNEXPECTED format"
fi

# 4. Supabase URL format
echo "--- Supabase URL"
SUPA_URL="${NEXT_PUBLIC_SUPABASE_URL:-}"
if echo "$SUPA_URL" | grep -qE '^https://[a-z]+\.supabase\.co$'; then
  check "Supabase URL format" "ok"
elif [ -n "$SUPA_URL" ]; then
  check "Supabase URL format" "unexpected: $SUPA_URL"
fi

# 5. TypeScript
echo "--- TypeScript"
if npx tsc --noEmit 2>&1 | grep -q 'error TS'; then
  check "TypeScript" "ERRORS — run npx tsc --noEmit"
else
  check "TypeScript" "ok"
fi

# 6. Summary
echo ""
echo "=== Result: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
