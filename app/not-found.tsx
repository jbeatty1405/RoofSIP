import Link from 'next/link'

export const metadata = {
  title: 'Page not found — RoofSIP',
}

export default function NotFound() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-200 flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-cyan-400 text-sm font-semibold mb-3">404</p>
        <h1 className="text-3xl font-bold text-white mb-3">This page doesn&apos;t exist</h1>
        <p className="text-zinc-400 text-sm leading-relaxed mb-8">
          The link may be out of date, or the page may have moved. Nothing is wrong with your
          account.
        </p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-cyan-400"
        >
          Back to RoofSIP
        </Link>
      </div>
    </main>
  )
}
