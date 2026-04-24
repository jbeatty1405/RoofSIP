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
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        active
          ? 'bg-sky-50 text-sky-700 font-medium'
          : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
      }`}
    >
      {icon && <span className={`shrink-0 ${active ? 'text-sky-500' : 'text-zinc-400'}`}>{icon}</span>}
      <span className="flex-1">{label}</span>
      {badge ? (
        <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </Link>
  )
}
