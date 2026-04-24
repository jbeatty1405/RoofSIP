'use client'

export default function ConnectGoogleButton({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      className="inline-block px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors"
    >
      {label}
    </a>
  )
}
