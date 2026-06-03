import Link from 'next/link'

export const metadata = {
  title: 'Support — RoofSIP',
}

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-200">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link href="/" className="text-cyan-400 text-sm hover:underline mb-8 inline-block">← Back to RoofSIP</Link>
        <h1 className="text-3xl font-bold text-white mb-2">Support</h1>
        <p className="text-zinc-500 text-sm mb-10">We're here to help. Most questions are answered within one business day.</p>

        <div className="space-y-8 text-sm text-zinc-400 leading-relaxed">

          <section>
            <h2 className="text-white text-lg font-semibold mb-2">Contact Us</h2>
            <p>
              Email{' '}
              <a href="mailto:azroofsip@gmail.com" className="text-cyan-400 hover:underline">
                azroofsip@gmail.com
              </a>{' '}
              and we'll get back to you within one business day. Please include your account email
              and a short description of what you need help with.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-2">Common Questions</h2>
            <ul className="list-disc pl-5 space-y-3">
              <li>
                <strong className="text-zinc-300">Getting started:</strong> After signing in, add the
                cities you cover as a market, then add homeowners (with their consent to be texted).
                RoofSIP watches NOAA storm data for those areas and alerts homeowners after weather events.
              </li>
              <li>
                <strong className="text-zinc-300">Managing your subscription:</strong> Your RoofSIP
                subscription is purchased and managed on our website at{' '}
                <a href="https://roofsip.vercel.app" className="text-cyan-400 hover:underline">roofsip.vercel.app</a>.
                You can update or cancel it there at any time.
              </li>
              <li>
                <strong className="text-zinc-300">Deleting your account:</strong> Open the app, go to
                Settings → Delete Account. This permanently removes your account and all associated data.
              </li>
              <li>
                <strong className="text-zinc-300">Data requests:</strong> To access, correct, or delete
                your personal data, email us at the address above and we'll respond within 30 days.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-2">For Homeowners Who Received a Text</h2>
            <p>
              RoofSIP sends texts on behalf of roofing contractors only to homeowners who have agreed
              to receive them. To stop messages, reply <strong className="text-zinc-200">STOP</strong> to
              any text — opt-out is immediate. Reply <strong className="text-zinc-200">HELP</strong> for
              assistance, or email{' '}
              <a href="mailto:azroofsip@gmail.com" className="text-cyan-400 hover:underline">azroofsip@gmail.com</a>.
              Message and data rates may apply.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-2">More</h2>
            <p>
              See our{' '}
              <Link href="/privacy" className="text-cyan-400 hover:underline">Privacy Policy</Link>{' '}
              and{' '}
              <Link href="/terms" className="text-cyan-400 hover:underline">Terms of Service</Link>.
            </p>
          </section>

        </div>
      </div>
    </main>
  )
}
