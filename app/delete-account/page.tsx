import Link from 'next/link'

export const metadata = {
  title: 'Delete Your Account — RoofSIP',
  description: 'How to delete your RoofSIP account and what data is removed.',
}

/**
 * Public account-deletion instructions.
 *
 * Google Play's User Data policy requires a publicly reachable URL where a user can
 * find out how to delete their account and what happens to their data, without
 * needing to install the app or sign in. In-app deletion already exists (mobile
 * Settings, the muted link under the SUPPORT group, which POSTs to
 * /api/account/delete) but a signed-in-only route does not satisfy the policy, so
 * this page must stay in `isPublicRoute` in proxy.ts.
 *
 * The steps below must match the mobile app exactly — a reviewer follows them
 * literally. There is no delete control on the web dashboard, so do not tell
 * people to sign in here to delete.
 */
export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-200">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link href="/" className="text-cyan-400 text-sm hover:underline mb-8 inline-block">← Back to RoofSIP</Link>
        <h1 className="text-3xl font-bold text-white mb-2">Delete Your Account</h1>
        <p className="text-zinc-500 text-sm mb-10">RoofSIP LLC · Peoria, Arizona</p>

        <div className="max-w-none space-y-8 text-sm text-zinc-400 leading-relaxed">

          <section>
            <h2 className="text-white text-lg font-semibold mb-2">Delete it yourself, in the app</h2>
            <p>The fastest way. Deletion is immediate and does not need our help.</p>
            <ol className="list-decimal pl-5 mt-3 space-y-1">
              <li>Open the RoofSIP app on your phone</li>
              <li>Go to <span className="text-zinc-200">Settings</span></li>
              <li>Scroll to the bottom and tap <span className="text-zinc-200">Delete account</span></li>
              <li>Confirm on the warning that appears</li>
            </ol>
            <p className="mt-3">
              Account deletion is in the mobile app only. If you do not have the app installed, use
              the email route below.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-2">Ask us to delete it</h2>
            <p>
              If you cannot sign in, email{' '}
              <a href="mailto:azroofsip@gmail.com" className="text-cyan-400 hover:underline">
                azroofsip@gmail.com
              </a>{' '}
              from the address on the account with the subject &quot;Delete my account&quot;. We
              verify ownership of the address and then delete the account. Requests are handled
              within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-2">What gets deleted</h2>
            <p>All of it, permanently. Deleting the account removes:</p>
            <ul className="list-disc pl-5 mt-3 space-y-1">
              <li>Your login and profile, including your name, email address and phone number</li>
              <li>Every homeowner you added, including their names, addresses and phone numbers</li>
              <li>All storm alerts, scheduled appointments and booking history</li>
              <li>The full text message history between RoofSIP and your homeowners</li>
              <li>Your working hours, blackout dates and notification settings</li>
            </ul>
            <p className="mt-3">
              Any active subscription is cancelled at the same time, so you are not billed again.
              None of this is recoverable once it is done.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-2">What we keep, and why</h2>
            <p>
              Records of payments we have already processed are retained by our payment provider,
              Stripe, and by us in summary form, because tax and accounting law requires it. These
              records contain the transaction, not your homeowner list. Text messages already
              delivered may persist in our carrier&apos;s logs, which we do not control, for the
              period that carrier retains them.
            </p>
          </section>

          <section>
            <p className="text-zinc-500">
              See our{' '}
              <Link href="/privacy" className="text-cyan-400 hover:underline">Privacy Policy</Link>{' '}
              for the full picture of what we collect and how it is used.
            </p>
          </section>

        </div>
      </div>
    </main>
  )
}
