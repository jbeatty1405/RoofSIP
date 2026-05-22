import Link from 'next/link'
import Logo from '@/app/_components/Logo'

function StormIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/>
      <polyline points="13 11 9 17 15 17 11 23"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/>
        <polyline points="13 11 9 17 15 17 11 23"/>
      </svg>
    ),
    title: 'NOAA Storm Monitoring',
    desc: 'Checks weather data every hour across all your markets. When hail or wind hits, your homeowners hear about it first.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    title: 'AI-Written Messages',
    desc: 'Claude writes a unique SMS for each homeowner — not a blast, a personal note. You set the tone, AI does the writing.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    title: 'Booking Confirmation',
    desc: 'Homeowner replies YES → you get an email with the details and a one-click confirm. Nothing hits your calendar without your OK.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
      </svg>
    ),
    title: 'Market-Based Sending',
    desc: 'Organize homeowners into markets with custom working hours and blackout dates. Texts go out at the right time in every area.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    title: 'TCPA Compliance Built In',
    desc: 'Every homeowner entry requires a consent checkbox. Opt-outs are honored instantly. You\'re covered.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
    title: 'Reply Tracking',
    desc: 'See every YES, NO, and STOP in one place. Full SMS thread history per homeowner, opt-out rate on the dashboard.',
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Add your homeowners',
    desc: 'Add people as you go — from your notepad, past jobs, or door-to-door. A name and phone number is all you need.',
  },
  {
    n: '02',
    title: 'Storm hits their area',
    desc: 'NOAA detects hail or wind. RoofSIP sends a personal text within the hour — sounds like you wrote it.',
  },
  {
    n: '03',
    title: 'Wake up to new appointments',
    desc: 'Homeowners say yes, Hailey handles the rest. Your calendar fills overnight. You just show up.',
  },
]

const PLAN_FEATURES = [
  '250 SMS/month included',
  'Unlimited homeowners',
  'Unlimited markets',
  'NOAA storm monitoring',
  'AI message generation',
  'Reply tracking & history',
  'Google Calendar sync',
  'TCPA compliance tools',
  '60-day free trial',
]

export default function LandingPage() {
  return (
    <div className="bg-zinc-950 text-zinc-200 min-h-screen overflow-x-hidden">

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <Logo size="md" />
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hidden sm:block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Privacy</Link>
            <Link href="/terms" className="hidden sm:block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Terms</Link>
            <Link href="/login" className="text-sm text-zinc-300 hover:text-white transition-colors">Sign in</Link>
            <Link href="/signup" className="text-sm bg-sky-500 hover:bg-sky-400 text-white font-medium px-4 py-1.5 rounded-lg transition-colors">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-5 pt-14 overflow-hidden">
        {/* Gradient orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="animate-orb-1 absolute -top-32 left-1/4 w-[600px] h-[600px] rounded-full bg-sky-600/10 blur-3xl" />
          <div className="animate-orb-2 absolute top-1/3 -right-32 w-[500px] h-[500px] rounded-full bg-indigo-600/8 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-zinc-950 to-transparent" />
        </div>

        {/* Grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '48px 48px' }}
        />

        <div className="relative z-10 max-w-4xl mx-auto">
          {/* Badge */}
          <div className="animate-fade-up inline-flex items-center gap-2 bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-medium px-3 py-1.5 rounded-full mb-8">
            <StormIcon />
            Storm Inspection Program for Roofing Contractors
          </div>

          <h1 className="animate-fade-up-delay text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.05]">
            Storm hits.<br />
            <span className="text-sky-400">RoofSIP texts.</span><br />
            You get the job.
          </h1>

          <p className="animate-fade-up-delay-2 text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            AI-powered SMS outreach that contacts your homeowners automatically after NOAA detects storm activity — so you fill your calendar without picking up the phone.
          </p>

          <div className="animate-fade-up-delay-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="w-full sm:w-auto bg-sky-500 hover:bg-sky-400 text-white font-semibold px-8 py-3.5 rounded-xl text-base transition-colors shadow-lg shadow-sky-500/20"
            >
              Start free — 60 days on us
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-medium px-8 py-3.5 rounded-xl text-base transition-colors"
            >
              Sign in →
            </Link>
          </div>
          <p className="text-zinc-600 text-sm mt-4">No credit card required · Cancel anytime</p>
        </div>

        {/* Mock SMS preview */}
        <div className="relative z-10 mt-20 w-full max-w-sm mx-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-2xl shadow-black/60">
            {/* Header bar */}
            <div className="flex items-center gap-3 pb-3 border-b border-zinc-800 mb-3">
              <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">
                SC
              </div>
              <div>
                <p className="text-white text-sm font-medium">Sarah C.</p>
                <p className="text-zinc-500 text-xs">Text Message</p>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                </span>
                <span className="text-zinc-600 text-xs">now</span>
              </div>
            </div>
            {/* SMS bubbles */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-start">
                <div className="bg-zinc-800 rounded-2xl rounded-tl-sm px-3.5 py-2.5 max-w-[85%]">
                  <p className="text-zinc-200 leading-snug">Hey Sarah, Marcus here from Titan Roofing. Saw that hail came through your area yesterday — wanted to check in and see if your roof came out okay. We're doing free inspections for a few homeowners this week if you want us to swing by.</p>
                </div>
              </div>
              <p className="text-zinc-600 text-xs text-left pl-1">10:43 AM</p>
              <div className="flex justify-end">
                <div className="bg-sky-500 rounded-2xl rounded-tr-sm px-3.5 py-2.5 max-w-[80%]">
                  <p className="text-white leading-snug">Oh wow yeah that'd be great, I did notice some stuff on the porch</p>
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-zinc-800 rounded-2xl rounded-tl-sm px-3.5 py-2.5 max-w-[85%]">
                  <p className="text-zinc-200 leading-snug">Perfect. I'll put you down for Thursday at 9am — does that work?</p>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="bg-sky-500 rounded-2xl rounded-tr-sm px-3.5 py-2.5">
                  <p className="text-white leading-snug">Works for me 👍</p>
                </div>
              </div>
            </div>
          </div>
          {/* Glow under card */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-48 h-12 bg-sky-500/20 blur-2xl rounded-full" />
        </div>

        <div className="relative z-10 mt-16 mb-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto animate-bounce">
            <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
          </svg>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sky-400 text-sm font-semibold uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white">Three steps. Zero phone calls.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {STEPS.map((step) => (
              <div key={step.n} className="relative bg-zinc-900 border border-zinc-800 rounded-2xl p-7 hover:border-zinc-700 transition-colors">
                <div className="text-5xl font-black text-zinc-800 mb-4 leading-none">{step.n}</div>
                <h3 className="text-white font-semibold text-lg mb-2">{step.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-5 border-t border-zinc-800/60">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sky-400 text-sm font-semibold uppercase tracking-widest mb-3">Everything you need</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white">Built for roofers. Not software people.</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 hover:bg-zinc-900/80 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-4 group-hover:bg-sky-500/15 transition-colors">
                  {f.icon}
                </div>
                <h3 className="text-white font-semibold mb-1.5">{f.title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-5 border-t border-zinc-800/60">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sky-400 text-sm font-semibold uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white">Simple. One plan. No surprises.</h2>
          </div>
          <div className="max-w-sm mx-auto">
            <div className="relative bg-zinc-900 border border-sky-500/30 rounded-2xl p-8 shadow-2xl shadow-sky-500/5">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-sky-500 text-white text-xs font-bold px-4 py-1 rounded-full">
                60-DAY FREE TRIAL
              </div>
              <div className="text-center mb-8">
                <div className="flex items-end justify-center gap-1">
                  <span className="text-5xl font-black text-white">$20</span>
                  <span className="text-zinc-500 mb-1.5">/month</span>
                </div>
                <p className="text-zinc-500 text-sm mt-1">250 SMS included · add-ons available</p>
              </div>
              <ul className="space-y-3 mb-8">
                {PLAN_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-zinc-300">
                    <span className="text-sky-400 flex-shrink-0"><CheckIcon /></span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="block w-full text-center bg-sky-500 hover:bg-sky-400 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-sky-500/20"
              >
                Start free trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* SMS Disclosure */}
      <section className="py-10 px-5 border-t border-zinc-800/60 bg-zinc-900/40">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-zinc-500 text-xs leading-relaxed">
            <span className="text-zinc-400 font-medium">SMS Disclosure:</span> RoofSIP sends text messages only to homeowners whose contact information and explicit TCPA consent have been entered by the contractor using this platform. Homeowners may opt out at any time by replying <strong className="text-zinc-300">STOP</strong>. Message and data rates may apply. For help, reply <strong className="text-zinc-300">HELP</strong> or contact{' '}
            <a href="mailto:azroofsip@gmail.com" className="text-sky-500 hover:underline">azroofsip@gmail.com</a>.
          </p>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-24 px-5 border-t border-zinc-800/60">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to turn storms into revenue?
          </h2>
          <p className="text-zinc-400 mb-8">Start your free trial today. No credit card, no commitment.</p>
          <Link
            href="/signup"
            className="inline-block bg-sky-500 hover:bg-sky-400 text-white font-semibold px-10 py-4 rounded-xl text-lg transition-colors shadow-xl shadow-sky-500/20"
          >
            Get started free →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/60 py-8 px-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-600">
          <Logo size="sm" />
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-zinc-400 transition-colors">Terms of Service</Link>
            <a href="mailto:azroofsip@gmail.com" className="hover:text-zinc-400 transition-colors">Contact</a>
          </div>
          <p>© {new Date().getFullYear()} RoofSIP</p>
        </div>
      </footer>
    </div>
  )
}
