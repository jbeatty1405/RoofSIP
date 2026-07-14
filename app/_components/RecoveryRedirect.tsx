'use client'

import { useEffect } from 'react'

/**
 * Password-reset links land on the Supabase Site URL (this page) with the recovery
 * tokens in the hash. Forward them, hash intact, to the screen that can actually use them.
 */
export default function RecoveryRedirect() {
  useEffect(() => {
    const hash = window.location.hash
    const search = window.location.search
    const isRecovery =
      /(^|[#&])type=recovery(&|$)/.test(hash) || new URLSearchParams(search).get('type') === 'recovery'

    if (isRecovery) {
      window.location.replace(`/reset-password${search}${hash}`)
    }
  }, [])

  return null
}
