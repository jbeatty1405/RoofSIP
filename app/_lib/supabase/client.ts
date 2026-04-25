'use client'

import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://bzdkftdaclmrblyhoweo.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6ZGtmdGRhY2xtcmJseWhvd2VvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4OTE4NzMsImV4cCI6MjA5MjQ2Nzg3M30.RwfWUEGBTyc7JLY-w8SvfO47f7FaxEcWvMa5g8y1pho'

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}
