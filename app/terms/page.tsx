import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service — RoofSIP',
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-200">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link href="/" className="text-cyan-400 text-sm hover:underline mb-8 inline-block">← Back to RoofSIP</Link>
        <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-zinc-500 text-sm mb-10">Effective date: May 1, 2026</p>

        <div className="space-y-8 text-sm text-zinc-400 leading-relaxed">

          <section>
            <h2 className="text-white text-lg font-semibold mb-2">1. Acceptance</h2>
            <p>
              By creating a RoofSIP account you agree to these Terms of Service. If you do not
              agree, do not use the platform.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-2">2. Description of Service</h2>
            <p>
              RoofSIP is a software-as-a-service platform that enables roofing contractors to
              monitor storm activity and send automated SMS inspection reminders to homeowners
              who have consented to receive such messages.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-2">3. SMS and Compliance Obligations</h2>
            <p>
              By using RoofSIP's SMS features, you represent and warrant that:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>You have obtained prior express written consent from each homeowner before sending any SMS message.</li>
              <li>You will maintain records of consent and provide them upon request.</li>
              <li>You will honor all opt-out requests (STOP replies) immediately.</li>
              <li>You will comply with the Telephone Consumer Protection Act (TCPA), the CAN-SPAM Act, and all applicable federal and state regulations governing commercial text messaging.</li>
            </ul>
            <p className="mt-3">
              RoofSIP is not responsible for TCPA violations or other messaging-law violations
              resulting from a contractor's failure to obtain proper consent.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-2">4. Prohibited Use</h2>
            <p>You may not use RoofSIP to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Send messages to individuals who have not consented to receive them.</li>
              <li>Send spam, phishing, or deceptive messages.</li>
              <li>Violate any law or regulation.</li>
              <li>Attempt to reverse-engineer, copy, or resell the platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-2">5. Subscription and Billing</h2>
            <p>
              RoofSIP is billed monthly. Plans include a 60-day free trial. After the trial,
              your payment method will be charged at the then-current plan rate. You may cancel
              at any time; cancellation takes effect at the end of the current billing period.
              No refunds for partial months.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-2">6. Termination</h2>
            <p>
              We may suspend or terminate accounts that violate these Terms, including misuse
              of the SMS system. You may terminate your account at any time by contacting{' '}
              <a href="mailto:azroofsip@gmail.com" className="text-cyan-400 hover:underline">
                azroofsip@gmail.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-2">7. Limitation of Liability</h2>
            <p>
              RoofSIP is provided "as is." We are not liable for indirect, incidental, or
              consequential damages. Our total liability is limited to the amount you paid us
              in the 30 days preceding a claim.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-2">8. Governing Law</h2>
            <p>These Terms are governed by the laws of the State of Arizona.</p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-2">9. Contact</h2>
            <p>
              Questions?{' '}
              <a href="mailto:azroofsip@gmail.com" className="text-cyan-400 hover:underline">
                azroofsip@gmail.com
              </a>
            </p>
          </section>

        </div>
      </div>
    </main>
  )
}
