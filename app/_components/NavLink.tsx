'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'

export default function NavLink({ href, label, badge, icon }: { href: string; label: string; badge?: number; icon?: ReactNode }) {
  const pathname = usePathname()
  const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
        active
          ? 'bg-sky-500/10 text-sky-400 font-medium'
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
      }`}
    >
      {icon && <span className={`shrink-0 ${active ? 'text-sky-400' : 'text-zinc-500'}`}>{icon}</span>}
      <span className="flex-1">{label}</span>
      {badge ? (
        <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </Link>
  )
}
