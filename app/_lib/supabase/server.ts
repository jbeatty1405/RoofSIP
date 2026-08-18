import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Read at call time, not at module load.
 *
 * These used to be module-level constants with a `!` on them, which meant the
 * mere act of importing this file threw `Cannot read properties of undefined
 * (reading 'replace')` when a var was missing. Next collects page data by
 * importing every route, so that killed the whole build — with no variable
 * name in the message — and it is why every preview deploy has failed since
 * previews were first opened: Preview has none of these vars set, only
 * Production does. Reading lazily lets a build succeed without secrets and
 * moves the failure to the request that actually needs one, by name.
 *
 * The whitespace strip stays: JWTs pasted into dashboards carry hidden \n,
 * which breaks SSR auth.
 */
function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value.replace(/\s/g, '')
}

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
      },
    },
  })
}

/**
 * @deprecated DO NOT USE. Despite the name this is NOT service_role.
 *
 * It is handed the service key and the request cookies, and when a user is
 * signed in that session wins — every query runs as `authenticated`. It has
 * silently broken three separate things: /api/schedule's blocked_dates writes,
 * the checkout rate limiter, and the intro-SMS log (which made the storm cron
 * re-text homeowners). Each one failed quietly because the error was ignored.
 *
 * Use createAdminClient() below. This is kept only for the remaining webhook
 * and cron callers, which have no cookies and are therefore unaffected; once
 * they are migrated, delete it.
 */
export async function createServiceClient() {
  const cookieStore = await cookies()
  return createServerClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
      },
    },
  })
}

/**
 * Genuinely service_role — no cookies, ever.
 *
 * createServiceClient() above is handed the service key but ALSO the request
 * cookies, and when a user is signed in that session wins: the client acts as
 * that user, not as service_role. Anything needing real elevated privilege
 * silently loses it. That is how the checkout rate limiter died on 2026-06-17
 * with `permission denied for function checkout_rate_limit` and stayed broken
 * for seven weeks.
 *
 * Use this for privileged work inside a signed-in request: RPCs the caller
 * isn't granted, cross-user reads, anything that must bypass RLS on purpose.
 * Because it ignores cookies it has NO user context, so never rely on it for
 * auth — establish who the caller is with createClient() first.
 */
export function createAdminClient() {
  return createServerClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    cookies: {
      getAll() { return [] },
      setAll() {},
    },
  })
}
