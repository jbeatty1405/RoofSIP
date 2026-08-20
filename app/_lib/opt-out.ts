// Opt-out: recognizing "stop" in every form a homeowner actually sends it, and
// recognizing an opted-out homeowner in the UI.
//
// Two failures this file exists to prevent, both seen in production:
//
// 1) Only exact keywords counted. Twilio's carrier-level filter catches the
//    standard keywords and nothing else, so "stop texting me" or "take me off
//    this list" arrived as ordinary text and fell through to the booking logic
//    — the homeowner got ANOTHER text back and the PM got a "call to
//    reschedule" lead. The exact opposite of what they asked for.
//
// 2) STOP leaves sms_confirmed true (we keep the record that they did once
//    confirm, for the TCPA audit trail). Any UI that checked sms_confirmed
//    before checking consent therefore painted an opted-out homeowner as
//    "SMS active" — which is what made a STOP look like nothing happened.

/**
 * Lowercase, drop punctuation/emoji, collapse whitespace. "STOP!" -> "stop".
 * Apostrophes are dropped rather than kept, so "don't text" and "dont text"
 * normalize to the same string and only one has to be listed below.
 */
export function normalizeMessage(body: string | null | undefined): string {
  return (body ?? '')
    .toLowerCase()
    .replace(/['‘’]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// The whole message is one of these. Mirrors the carrier/CTIA keyword set.
const OPT_OUT_KEYWORDS = new Set([
  'stop', 'stopall', 'stop all', 'stop please', 'unsubscribe', 'cancel',
  'quit', 'end', 'revoke', 'optout', 'opt out', 'remove', 'remove me',
])

// Unambiguous anywhere in a sentence — no word here has a scheduling meaning.
const STRONG_PHRASES = [
  'unsubscribe', 'opt me out', 'opt out', 'remove me', 'take me off',
  'delete my number', 'lose my number', 'never text', 'no more text',
  'no more message', 'leave me alone',
  'do not text', 'dont text', 'do not contact', 'dont contact',
  'do not message', 'dont message', 'do not send', 'dont send',
  'do not want', 'dont want any',
]

// Contain "stop"/"quit", so they run only after the scheduling guard below.
const STOP_PHRASES = [
  'stop texting', 'stop messaging', 'stop sending', 'stop contacting',
  'stop text', 'stop message', 'stop these', 'stop all', 'please stop',
  'quit texting', 'quit messaging',
]

// "have him stop by Tuesday" is a homeowner booking an inspection, not an
// opt-out. Deliberately no "call" variants either: one homeowner replied
// "Tuesday afternoon / Don't call / Just let me know between 1 & 3 pm" — they
// wanted the texts and would have been silenced by a looser matcher.
const SCHEDULING_STOP = /\bstop\s+(by|in|over|out)\b/

/** True when the homeowner is asking us to stop texting them, in any phrasing. */
export function isOptOutMessage(body: string | null | undefined): boolean {
  const norm = normalizeMessage(body)
  if (!norm) return false
  if (OPT_OUT_KEYWORDS.has(norm)) return true
  if (STRONG_PHRASES.some(p => norm.includes(p))) return true
  if (SCHEDULING_STOP.test(norm)) return false
  return STOP_PHRASES.some(p => norm.includes(p))
}

// START/UNSTOP is the carrier-standard opt-back-in, and what our opt-out
// confirmation tells them to send — so it has to actually work.
const OPT_IN_KEYWORDS = new Set(['start', 'unstop', 'restart', 'resume'])

/** True when the message is the standard opt-back-in keyword. */
export function isOptBackInMessage(body: string | null | undefined): boolean {
  return OPT_IN_KEYWORDS.has(normalizeMessage(body))
}

/**
 * Did this homeowner opt out, as opposed to never having consented?
 *
 * opted_out_at is the real answer and is checked first. The fallback below is
 * kept for two reasons: rows written before that column existed, and any read
 * path that doesn't select it. It infers an opt-out from consent being false
 * PLUS evidence of a consent that existed once — because consent false on its
 * own is also the resting state of a CSV import and of every monitor-only home,
 * neither of which ever sets tcpa_consent_at. That gap is exactly what
 * opted_out_at closes: a monitor-only homeowner who texts STOP is invisible to
 * the fallback and visible to the column.
 */
export function isOptedOut(h: {
  tcpa_consent?: boolean | null
  tcpa_consent_at?: string | null
  sms_confirmed?: boolean | null
  opted_out_at?: string | null
}): boolean {
  if (h.opted_out_at) return true
  return h.tcpa_consent === false && !!(h.tcpa_consent_at || h.sms_confirmed)
}
