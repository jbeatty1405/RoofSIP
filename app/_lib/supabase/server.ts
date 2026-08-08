import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\s/g, '')
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.replace(/\s/g, '')

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
      },
    },
  })
}

export async function createServiceClient() {
  const cookieStore = await cookies()
  return createServerClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!.replace(/\s/g, ''), {
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
  return createServerClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!.replace(/\s/g, ''), {
    cookies: {
      getAll() { return [] },
      setAll() {},
    },
  })
}
