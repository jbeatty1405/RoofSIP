export default function HaileyBanner({ pmName, recentActivity }: { pmName?: string | null; recentActivity?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 mb-8" style={{ minHeight: 200 }}>
      {/* Hailey image — faded in from the right */}
      <div
        className="absolute inset-y-0 right-0 w-72 md:w-96"
        style={{
          backgroundImage: 'url(/hailey.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
        }}
      >
        {/* Gradient fade left */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #18181b 0%, #18181b 10%, transparent 60%)' }} />
        {/* Gradient fade bottom */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #18181b 0%, transparent 40%)' }} />
      </div>

      {/* Content */}
      <div className="relative z-10 px-6 py-7 max-w-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
          <span className="text-xs text-sky-400 font-medium tracking-wide uppercase">Online</span>
        </div>
        <h2 className="text-2xl font-bold text-white mb-1">Meet Hailey</h2>
        <p className="text-sm text-zinc-400 leading-relaxed mb-4">
          Your AI storm assistant. She watches the weather, texts your homeowners when conditions hit, and handles inspection scheduling — so you show up to jobs, not phones.
        </p>
        <p className="text-xs text-zinc-600">
          {recentActivity ?? 'Monitoring storm activity across your markets.'}
        </p>
      </div>
    </div>
  )
}
