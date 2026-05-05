import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — RoofSIP',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-200">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link href="/" className="text-cyan-400 text-sm hover:underline mb-8 inline-block">← Back to RoofSIP</Link>
        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-zinc-500 text-sm mb-10">Effective date: May 1, 2025</p>

        <div className="prose prose-invert prose-zinc max-w-none space-y-8 text-sm text-zinc-400 leading-relaxed">

          <section>
            <h2 className="text-white text-lg font-semibold mb-2">1. Who We Are</h2>
            <p>
              RoofSIP ("we", "us", or "our") is a SaaS platform that helps roofing contractors
              monitor storm activity and send SMS inspection reminders to homeowners who have
              provided consent. Contact us at{' '}
              <a href="mailto:azroofsip@gmail.com" className="text-cyan-400 hover:underline">
                azroofsip@gmail.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-2">2. Information We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-zinc-300">Contractor accounts:</strong> name, email address, business information, payment method (processed by Stripe).</li>
              <li><strong className="text-zinc-300">Homeowner records:</strong> name, phone number, address, ZIP code — entered by the contractor with the homeowner's consent.</li>
              <li><strong className="text-zinc-300">Usage data:</strong> log files, IP addresses, browser/device type for security and analytics.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-2">3. SMS Messaging</h2>
            <p>
              RoofSIP sends SMS messages to homeowners only when the contractor has confirmed that
              the homeowner has provided explicit consent to receive text messages about roofing
              inspections. Each homeowner record includes a TCPA consent checkbox and timestamp.
            </p>
            <p className="mt-3">
              <strong className="text-zinc-300">Opt-out:</strong> Homeowners may opt out at any time
              by replying <strong className="text-zinc-200">STOP</strong> to any message. Opt-out
              requests are processed immediately and no further messages will be sent. Homeowners may
              also reply <strong className="text-zinc-200">HELP</strong> for assistance.
            </p>
            <p className="mt-3">Message and data rates may apply. Message frequency varies.</p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-2">4. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide the RoofSIP platform and send SMS messages on behalf of contractors.</li>
              <li>To process payments and manage subscriptions.</li>
              <li>To monitor storm activity via NOAA weather data.</li>
              <li>To improve the platform and diagnose technical issues.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-2">5. Information Sharing</h2>
            <p>
              We do not sell, trade, or rent personal information. We share data only with
              service providers necessary to operate the platform: Twilio (SMS delivery),
              Stripe (payments), Supabase (database), and Vercel (hosting). Each provider
              is bound by their own privacy policy and data processing agreements.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-2">6. Data Retention</h2>
            <p>
              Contractor account data is retained while the account is active and for 30 days
              after cancellation. Homeowner records are retained at the contractor's discretion
              and deleted upon request. SMS logs are retained for 90 days.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-2">7. Security</h2>
            <p>
              All data is encrypted in transit (TLS) and at rest. Access is controlled via
              role-based authentication. We do not store payment card details; all payment
              processing is handled by Stripe.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-2">8. Your Rights</h2>
            <p>
              You may request access to, correction of, or deletion of your personal data by
              contacting us at{' '}
              <a href="mailto:azroofsip@gmail.com" className="text-cyan-400 hover:underline">
                azroofsip@gmail.com
              </a>. We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-2">9. Changes to This Policy</h2>
            <p>
              We may update this policy periodically. Material changes will be communicated
              via email to registered contractors. Continued use of the platform after changes
              constitutes acceptance of the updated policy.
            </p>
          </section>

        </div>
      </div>
    </main>
  )
}
