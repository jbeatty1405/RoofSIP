import { createServiceClient } from '@/app/_lib/supabase/server'
import { verifyBookingToken } from '@/app/_lib/booking-token'
import ConfirmForm from './ConfirmForm'

export const dynamic = 'force-dynamic'

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; id?: string }>
}) {
  const { token } = await searchParams

  if (!token) return <Layout title="Invalid link" body="This confirmation link is missing or malformed." />

  const verified = verifyBookingToken(token)
  if (!verified) return <Layout title="Link expired" body="This confirmation link has expired or is invalid. Reply to the email with your preferred time and we'll resend." />

  const supabase = await createServiceClient()
  const { data: pending } = await supabase
    .from('pending_bookings')
    .select('id, status, proposed_slot, homeowners(name, address, phone)')
    .eq('id', verified.pendingId)
    .maybeSingle()

  if (!pending) return <Layout title="Already confirmed" body="This inspection has already been booked or canceled." />
  if (pending.status !== 'awaiting_pm_confirmation') {
    return <Layout title="Already confirmed" body="This inspection has already been booked." />
  }

  const homeowner = Array.isArray(pending.homeowners) ? pending.homeowners[0] : pending.homeowners
  const proposed = new Date(pending.proposed_slot)
  const dateStr = proposed.toLocaleDateString('en-US', {
    timeZone: 'America/Phoenix', weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })

  return (
    <Layout
      title="Confirm inspection"
      body={
        <>
          <p style={{ margin: '0 0 4px', fontSize: 14, color: '#555' }}><strong>{homeowner?.name}</strong></p>
          <p style={{ margin: '0 0 4px', fontSize: 13, color: '#666' }}>{homeowner?.address}</p>
          <p style={{ margin: '0 0 24px', fontSize: 13, color: '#666' }}>{homeowner?.phone}</p>
          <p style={{ margin: '0 0 20px', fontSize: 15 }}>Proposed: <strong>{dateStr}</strong></p>
          <ConfirmForm token={token} />
        </>
      }
    />
  )
}

function Layout({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'sans-serif', padding: 40, maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, color: '#111', margin: '0 0 16px' }}>{title}</h1>
      <div style={{ color: '#333', fontSize: 14 }}>{body}</div>
    </div>
  )
}
