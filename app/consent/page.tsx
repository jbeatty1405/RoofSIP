export default function ConsentPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-800 px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">RoofSIP — SMS Opt-In Terms</h1>
        <p className="text-zinc-500 text-sm mb-10">Last updated: April 2026</p>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-2">What is RoofSIP?</h2>
          <p className="text-zinc-600 leading-relaxed">
            RoofSIP is a storm inspection program that connects homeowners with local roofing contractors.
            When storm activity is detected near a homeowner's address, RoofSIP sends an SMS notification
            on behalf of the homeowner's roofing contractor offering a free roof inspection.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-2">How Opt-In Works</h2>
          <p className="text-zinc-600 leading-relaxed mb-4">
            Homeowners are added to RoofSIP by their roofing contractor. When added, they receive the
            following opt-in message:
          </p>
          <div className="bg-zinc-100 rounded-lg px-5 py-4 text-sm text-zinc-700 border border-zinc-200">
            "Hi [First Name]! [Contractor Name] from [Company] added you to receive free storm alerts
            for your roof. When storm activity hits your area, we'll send a heads up and offer a free
            inspection. Reply YES to opt in or STOP to skip."
          </div>
          <p className="text-zinc-600 leading-relaxed mt-4">
            <strong>No messages are sent until the homeowner replies YES.</strong> This is a double
            opt-in process — the homeowner must take an affirmative action before receiving any
            further communications.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-2">Message Frequency</h2>
          <p className="text-zinc-600 leading-relaxed">
            Messages are only sent when storm activity is detected near the homeowner's ZIP code.
            Frequency varies based on local weather conditions — typically 0–4 messages per month.
            Homeowners may also receive a single booking confirmation message if they request an inspection.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-2">How to Opt Out</h2>
          <p className="text-zinc-600 leading-relaxed">
            Reply <strong>STOP</strong> to any message at any time to immediately opt out of all future
            messages. No further messages will be sent after receiving a STOP reply.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-2">Message &amp; Data Rates</h2>
          <p className="text-zinc-600 leading-relaxed">
            Standard message and data rates may apply depending on your mobile carrier and plan.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-2">Contact</h2>
          <p className="text-zinc-600 leading-relaxed">
            Questions? Email us at{' '}
            <a href="mailto:azroofsip@gmail.com" className="text-blue-600 underline">
              azroofsip@gmail.com
            </a>
          </p>
        </section>

        <p className="text-xs text-zinc-400 mt-12 border-t border-zinc-100 pt-6">
          RoofSIP · roof-sip.vercel.app
        </p>
      </div>
    </div>
  )
}
