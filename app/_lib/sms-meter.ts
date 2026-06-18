import nodemailer from 'nodemailer'

// Where the upsell signal goes (same inbox the Twilio spend alerts use).
const SIGNAL_EMAIL = 'jbeatty1405@yahoo.com'

// Per-account HARD ceiling for the automated storm path. The sms_cap (default
// 1,000) is the *included tier* / upsell trigger, NOT a wall — sends keep going
// past it. This higher number is the runaway backstop so a single account can't
// drain the global 4,000 budget and starve every other roofer (shared-fate).
// At ~$0.011/segment, 2,500 ≈ $27 for one account — and by then Justin's already
// been pinged at 1,000 and is selling them a team plan.
export const PER_ACCOUNT_HARD_CEILING = 2500

// Atomically bump a roofer's monthly SMS count. When a send crosses the account's
// sms_cap for the first time this month, email Justin: an account sending this
// much on a $20 flat plan is behaving like a whole company — an expansion signal,
// not abuse. Sends are NOT interrupted; this is a heads-up only.
//
// Returns the new monthly count (or null if the increment failed — caller should
// treat a failure as "don't trust the meter" but never as "block the send").
// supabase: a Supabase server client (service or SSR). Typed loose to match the
// house style and the @supabase/ssr return type, whose rpc() is a thenable
// builder rather than a plain Promise.
export async function bumpSmsCount(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> },
  rooferId: string,
  smsCap: number,
  label: string,
): Promise<number | null> {
  // Best-effort only: metering must NEVER throw into the send path. A send that
  // already went out must not be reported as failed just because the count bump
  // hiccuped, so the whole body is guarded.
  try {
    const { data, error } = await supabase.rpc('increment_sms_count', { p_id: rooferId })
    if (error) {
      console.error('increment_sms_count failed — SMS meter will undercount:', error)
      return null
    }
    const newCount = typeof data === 'number' ? data : null
    // Increments are +1, so the account passes through exactly === smsCap once.
    // Fire the signal there, exactly once per account per month.
    if (newCount !== null && newCount === smsCap) {
      await notifyCompanySignal(rooferId, smsCap, label).catch((e) =>
        console.error('company-signal email failed:', e),
      )
    }
    return newCount
  } catch (e) {
    console.error('bumpSmsCount failed (send already sent — ignoring):', e)
    return null
  }
}

async function notifyCompanySignal(rooferId: string, smsCap: number, label: string) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  })
  await transporter.sendMail({
    from: `RoofSIP <${process.env.GMAIL_USER}>`,
    to: SIGNAL_EMAIL,
    subject: `📈 RoofSIP upsell signal — ${label} hit ${smsCap} texts this month`,
    text:
      `${label} (roofer ${rooferId}) just crossed ${smsCap} SMS this month on the $20 flat plan.\n\n` +
      `An account sending this much is running like a whole company, not a solo roofer — ` +
      `this is your cue to reach out about a team/company plan.\n\n` +
      `Sends are NOT blocked. They keep flowing up to the ${PER_ACCOUNT_HARD_CEILING}/account runaway ` +
      `backstop (and the global 4,000 / $50 Twilio kill behind that). This is a heads-up only.`,
  })
}
