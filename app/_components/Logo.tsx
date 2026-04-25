export default function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: { icon: 20, text: 'text-base' },
    md: { icon: 26, text: 'text-xl' },
    lg: { icon: 34, text: 'text-2xl' },
  }
  const s = sizes[size]

  return (
    <div className="flex items-center gap-2">
      <svg width={s.icon} height={s.icon} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 16L16 4L30 16" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M6 13.5V26C6 26.5523 6.44772 27 7 27H13V20H19V27H25C25.5523 27 26 26.5523 26 26V13.5" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span className={`font-bold tracking-tight text-white ${s.text}`}>
        Roof<span className="text-sky-500">SIP</span>
      </span>
    </div>
  )
}
