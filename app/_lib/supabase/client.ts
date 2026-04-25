'use client'

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    'https://bzdkftdaclmrblyhoweo.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6ZGtmdGRhY2xtcmJseWhvd2VvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4OTE4NzMsImV4cCI6MjA5MjQ2Nzg3M30.RwfWUEGBTyc7JLY-w8SvfO47f7FaxEcWvMa5g8y1pho'
  )
}
