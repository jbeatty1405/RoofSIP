import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-200 flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
          <span className="font-semibold text-lg tracking-tight text-white">RoofSIP</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/privacy" className="text-zinc-400 hover:text-zinc-200 transition-colors">Privacy</Link>
          <Link href="/terms" className="text-zinc-400 hover:text-zinc-200 transition-colors">Terms</Link>
          <Link
            href="/login"
            className="bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-medium px-4 py-1.5 rounded-md transition-colors"
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
          Storm Inspection Program<br />for Roofing Contractors
        </h1>
        <p className="text-zinc-400 text-lg mb-8 max-w-xl">
          RoofSIP monitors local storm activity and automatically sends AI-generated SMS messages
          to homeowners on your behalf — so you show up to jobs, not phones.
        </p>
        <Link
          href="/signup"
          className="bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-semibold px-8 py-3 rounded-lg text-lg transition-colors"
        >
          Get Started Free
        </Link>
        <p className="text-zinc-600 text-sm mt-3">60-day free trial · No credit card required</p>
      </section>

      {/* Features */}
      <section className="border-t border-zinc-800 py-16 px-6">
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-semibold text-white mb-2">Storm Monitoring</h3>
            <p className="text-zinc-400 text-sm">
              Automatically checks NOAA weather data for storm activity in your markets every hour.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-2">Automated SMS Outreach</h3>
            <p className="text-zinc-400 text-sm">
              AI-written, personalized text messages sent only to homeowners who have opted in
              to receive inspection reminders.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-2">Scheduling & Confirmation</h3>
            <p className="text-zinc-400 text-sm">
              Homeowners reply YES to schedule. You get an email confirmation before anything
              hits your calendar.
            </p>
          </div>
        </div>
      </section>

      {/* SMS opt-in disclosure */}
      <section className="border-t border-zinc-800 py-10 px-6 bg-zinc-900">
        <div className="max-w-3xl mx-auto text-center">
          <h3 className="font-semibold text-white mb-3">SMS Messaging Disclosure</h3>
          <p className="text-zinc-400 text-sm leading-relaxed">
            RoofSIP sends SMS messages only to homeowners whose contact information and explicit
            consent have been entered by the roofing contractor using this platform. Homeowners
            may opt out at any time by replying <strong className="text-zinc-200">STOP</strong> to
            any message. Message and data rates may apply. For help, reply{' '}
            <strong className="text-zinc-200">HELP</strong> or contact us at{' '}
            <a href="mailto:azroofsip@gmail.com" className="text-cyan-400 hover:underline">
              azroofsip@gmail.com
            </a>.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-6 px-6 text-center text-zinc-600 text-sm">
        <div className="flex items-center justify-center gap-6 mb-2">
          <Link href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-zinc-400 transition-colors">Terms of Service</Link>
          <a href="mailto:azroofsip@gmail.com" className="hover:text-zinc-400 transition-colors">Contact</a>
        </div>
        <p>© {new Date().getFullYear()} RoofSIP. All rights reserved.</p>
      </footer>
    </main>
  )
}
