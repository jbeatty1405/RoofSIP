export default function HaileyBanner({ pmName, recentActivity }: { pmName?: string | null; recentActivity?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 mb-8" style={{ minHeight: 300 }}>
      {/* Hailey image — faded in from the right */}
      <div
        className="absolute inset-y-0 right-0 w-80 md:w-[480px]"
        style={{
          backgroundImage: 'url(/hailey.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
        }}
      >
        {/* Gradient fade left */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #18181b 0%, #18181b 5%, rgba(24,24,27,0.6) 45%, transparent 70%)' }} />
        {/* Gradient fade bottom */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #18181b 0%, transparent 30%)' }} />
      </div>

      {/* Subtle blue glow behind text */}
      <div className="absolute left-0 top-0 bottom-0 w-64 opacity-20" style={{ background: 'radial-gradient(ellipse at left center, #0ea5e9, transparent 70%)' }} />

      {/* Content */}
      <div className="relative z-10 px-8 py-8 max-w-md flex flex-col justify-center h-full" style={{ minHeight: 300 }}>
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse shadow-sm shadow-sky-400" />
          <span className="text-xs text-sky-400 font-semibold tracking-widest uppercase">Active</span>
        </div>

        <p className="text-xs font-semibold text-zinc-500 tracking-widest uppercase mb-1">Meet your assistant</p>
        <h2 className="text-4xl font-bold text-white mb-3 tracking-tight" style={{ textShadow: '0 0 40px rgba(14,165,233,0.3)' }}>
          Hailey
        </h2>
        <p className="text-sm text-zinc-400 leading-relaxed mb-5 max-w-xs">
          Hailey monitors storms, reaches out to your homeowners automatically, and handles inspection scheduling — so you show up to jobs, not phones.
        </p>

        <div className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full bg-zinc-600" />
          <p className="text-xs text-zinc-600">
            {recentActivity ?? 'Monitoring storm activity across your markets.'}
          </p>
        </div>
      </div>
    </div>
  )
}
