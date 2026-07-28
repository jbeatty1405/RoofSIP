// Twilio delivers inbound `From` as E.164 (+1XXXXXXXXXX), but homeowner phones
// were historically stored in mixed formats (E.164 for some, bare 10-digit for
// others). The inbound webhook's homeowner lookup and every STOP/opt-out update
// must resolve a homeowner regardless of stored format — an exact-string match
// silently dropped every reply from a bare-stored number (the bug that lost all
// of one PM's inbound YES/STOP replies). Return the set of stored representations
// to match against with `.in('phone', ...)`.
export function phoneMatchCandidates(raw: string | null | undefined): string[] {
  const digits = (raw ?? '').replace(/\D/g, '')
  const last10 = digits.slice(-10)
  if (last10.length < 10) return raw ? [raw] : []
  return Array.from(
    new Set([raw as string, last10, `1${last10}`, `+1${last10}`].filter(Boolean)),
  )
}
