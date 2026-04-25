export default function HaileyBanner({ recentActivity }: { recentActivity?: string }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl mb-8"
      style={{
        minHeight: 380,
        background: '#0f1117',
        border: '1.5px solid rgba(14,165,233,0.45)',
        boxShadow: '0 0 32px rgba(14,165,233,0.18), 0 0 80px rgba(14,165,233,0.08), inset 0 0 40px rgba(14,165,233,0.04)',
      }}
    >
      {/* Hailey image — right side, tall */}
      <div
        className="absolute inset-y-0 right-0 w-72 md:w-[500px]"
        style={{
          backgroundImage: 'url(/hailey.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
        }}
      >
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #0f1117 0%, #0f1117 8%, rgba(15,17,23,0.5) 40%, transparent 65%)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #0f1117 0%, transparent 25%)' }} />
      </div>

      {/* Blue atmospheric glow behind text */}
      <div className="absolute left-0 top-0 bottom-0 w-80 opacity-25" style={{ background: 'radial-gradient(ellipse at left center, #0284c7, transparent 70%)' }} />

      {/* Content — vertically centered */}
      <div className="relative z-10 flex flex-col justify-center h-full px-8 md:px-12 py-10" style={{ minHeight: 380, maxWidth: 480 }}>
        <div className="flex items-center gap-2.5 mb-5">
          <span className="w-2 h-2 rounded-full bg-sky-400 shadow-lg" style={{ boxShadow: '0 0 8px #38bdf8' }} />
          <span className="text-xs font-bold text-sky-400 tracking-widest uppercase">Active · Monitoring</span>
        </div>

        <p className="text-xs font-semibold text-zinc-500 tracking-widest uppercase mb-2">Meet your assistant</p>

        <h2
          className="font-black text-white mb-4 leading-none"
          style={{
            fontSize: 'clamp(3rem, 6vw, 5rem)',
            textShadow: '0 0 60px rgba(14,165,233,0.4), 0 2px 20px rgba(0,0,0,0.8)',
            letterSpacing: '-0.02em',
          }}
        >
          Hailey
        </h2>

        <p className="text-base text-zinc-300 leading-relaxed mb-6" style={{ maxWidth: 340 }}>
          Your AI storm assistant. She monitors every homeowner in your network around the clock — and the moment a storm hits their neighborhood, she follows up automatically, handles the conversation, and gets the inspection on your calendar. You just show up to the job.
        </p>

        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
          <p className="text-xs text-zinc-500">
            {recentActivity ?? 'Monitoring storm activity across your markets.'}
          </p>
        </div>
      </div>
    </div>
  )
}
