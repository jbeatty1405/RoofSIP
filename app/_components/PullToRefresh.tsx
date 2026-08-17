'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

const THRESHOLD = 70
const MAX_PULL = 100

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef<number | null>(null)
  const scrollEl = useRef<HTMLElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  function onTouchStart(e: React.TouchEvent) {
    if (refreshing) return
    // The scrollable ancestor is the dashboard layout's <main>, not the window —
    // only start tracking a pull when that container is already at the top.
    const main = wrapperRef.current?.closest('main')
    if (!main || main.scrollTop > 0) return
    scrollEl.current = main
    startY.current = e.touches[0].clientY
  }

  function onTouchMove(e: React.TouchEvent) {
    if (startY.current === null || refreshing) return
    const delta = e.touches[0].clientY - startY.current
    if (delta > 0 && scrollEl.current && scrollEl.current.scrollTop === 0) {
      setPull(Math.min(delta * 0.5, MAX_PULL))
    }
  }

  function onTouchEnd() {
    if (pull >= THRESHOLD && !refreshing) {
      setRefreshing(true)
      router.refresh()
      window.setTimeout(() => {
        setRefreshing(false)
        setPull(0)
      }, 700)
    } else {
      setPull(0)
    }
    startY.current = null
  }

  return (
    <div ref={wrapperRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200 ease-out"
        style={{ height: refreshing ? THRESHOLD * 0.7 : pull }}
      >
        <div
          className={`w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full ${
            pull > 10 || refreshing ? 'animate-spin' : ''
          }`}
        />
      </div>
      {children}
    </div>
  )
}
