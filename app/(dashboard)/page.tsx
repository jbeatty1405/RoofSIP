import { createClient } from '@/app/_lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  redirect('/dashboard')
}
