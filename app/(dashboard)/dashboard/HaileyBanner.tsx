export default function HaileyBanner({ recentActivity }: { recentActivity?: string }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl mb-8"
      style={{
        minHeight: 160,
        background: '#0f1117',
        border: '1.5px solid rgba(14,165,233,0.45)',
        boxShadow: '0 0 32px rgba(14,165,233,0.18), 0 0 80px rgba(14,165,233,0.08), inset 0 0 40px rgba(14,165,233,0.04)',
      }}
    >
      {/* Hailey image — right side */}
      <div
        className="absolute inset-y-0 right-0 w-48 md:w-64"
        style={{
          backgroundImage: 'url(/hailey.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
        }}
      >
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #0f1117 0%, #0f1117 5%, rgba(15,17,23,0.4) 35%, transparent 60%)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #0f1117 0%, transparent 20%)' }} />
      </div>

      {/* Blue atmospheric glow */}
      <div className="absolute left-0 top-0 bottom-0 w-64 opacity-20" style={{ background: 'radial-gradient(ellipse at left center, #0284c7, transparent 70%)' }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-center h-full px-6 md:px-10 py-6" style={{ minHeight: 160, maxWidth: 420 }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" style={{ boxShadow: '0 0 6px #38bdf8' }} />
          <span className="text-xs font-bold text-sky-400 tracking-widest uppercase">Active · Monitoring</span>
        </div>

        <h2
          className="font-black text-white leading-none mb-2"
          style={{
            fontSize: 'clamp(2rem, 4vw, 2.75rem)',
            textShadow: '0 0 40px rgba(14,165,233,0.4), 0 2px 12px rgba(0,0,0,0.8)',
            letterSpacing: '-0.02em',
          }}
        >
          Hailey
        </h2>

        <p className="text-sm text-zinc-400 leading-relaxed mb-3" style={{ maxWidth: 300 }}>
          Your AI storm assistant — monitoring every homeowner around the clock and texting them the moment a storm hits.
        </p>

        <div className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full bg-zinc-700" />
          <p className="text-xs text-zinc-500">
            {recentActivity ?? 'Monitoring storm activity across your markets.'}
          </p>
        </div>
      </div>
    </div>
  )
}
