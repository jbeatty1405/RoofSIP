/**
 * First-touch signup attribution.
 *
 * Nothing used to record how anyone found RoofSIP, so every channel looked
 * identical from the inside and paid traffic would have been unmeasurable.
 *
 * First touch, not last touch: the ad or group post that first brought someone
 * here gets the credit, even if they wander the site before creating an account.
 * That means we only ever write to storage when there is nothing stored yet.
 */

const STORAGE_KEY = 'roofsip_attribution'

/** Trim anything crafted into a URL down to something sane before it hits the DB. */
const MAX_LEN = 120

export type Attribution = {
  signup_source?: string
  signup_medium?: string
  signup_campaign?: string
  signup_gclid?: string
}

function clean(value: string | null): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim().slice(0, MAX_LEN)
  return trimmed || undefined
}

/**
 * Record how this visitor arrived, if we have not already recorded it.
 * Safe to call on every page load.
 */
export function captureAttribution(): void {
  if (typeof window === 'undefined') return

  try {
    // First touch wins. Someone who arrived from an ad last week and comes back
    // direct today still counts as the ad's.
    if (window.localStorage.getItem(STORAGE_KEY)) return

    const params = new URLSearchParams(window.location.search)
    const gclid = clean(params.get('gclid'))
    const utmSource = clean(params.get('utm_source'))

    let attribution: Attribution = {
      signup_source: utmSource,
      signup_medium: clean(params.get('utm_medium')),
      signup_campaign: clean(params.get('utm_campaign')),
      signup_gclid: gclid,
    }

    // A Google Ads click always carries gclid but not always utm tags.
    if (gclid && !attribution.signup_source) {
      attribution = { ...attribution, signup_source: 'google', signup_medium: 'cpc' }
    }

    // No tags at all: fall back to the referring site. This is what catches
    // Facebook group traffic, where links get posted untagged.
    if (!attribution.signup_source && document.referrer) {
      try {
        const referrer = new URL(document.referrer)
        if (referrer.hostname && referrer.hostname !== window.location.hostname) {
          attribution = {
            ...attribution,
            signup_source: clean(referrer.hostname),
            signup_medium: 'referral',
          }
        }
      } catch {
        // Unparseable referrer is not worth failing over.
      }
    }

    // Nothing learned means direct traffic. Storing an empty object would lock
    // in "direct" and shut out a later tagged visit, so leave storage untouched.
    if (!Object.values(attribution).some(Boolean)) return

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(attribution))
  } catch {
    // Private browsing and blocked storage must never break signup.
  }
}

/** Whatever we know about how this visitor arrived. Empty object if nothing. */
export function getAttribution(): Attribution {
  if (typeof window === 'undefined') return {}

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return {}
    const parsed: unknown = JSON.parse(stored)
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as Attribution
  } catch {
    return {}
  }
}
