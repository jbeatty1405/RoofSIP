'use client'

import { useEffect } from 'react'
import { captureAttribution } from '@/app/_lib/attribution'

/**
 * Records how a visitor arrived, on whichever page they land on first.
 * Mounted in the root layout so an ad can point at any URL, not just the
 * homepage, and still be credited. Renders nothing.
 */
export default function AttributionCapture() {
  useEffect(() => {
    captureAttribution()
  }, [])

  return null
}
