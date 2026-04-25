import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SUPABASE_URL = 'https://bzdkftdaclmrblyhoweo.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6ZGtmdGRhY2xtcmJseWhvd2VvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4OTE4NzMsImV4cCI6MjA5MjQ2Nzg3M30.RwfWUEGBTyc7JLY-w8SvfO47f7FaxEcWvMa5g8y1pho'

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
  return createServerClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
      },
    },
  })
}
