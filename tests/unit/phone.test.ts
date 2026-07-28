import { describe, it, expect } from 'vitest'
import { phoneMatchCandidates } from '@/app/_lib/phone'

// Regression guard for the inbound-reply bug: homeowners were stored in mixed
// phone formats (E.164 and bare 10-digit), and the webhook's exact-string lookup
// dropped every reply from a bare-stored number. The candidate set must resolve a
// homeowner regardless of how their number was stored.
describe('phoneMatchCandidates', () => {
  it('matches a BARE 10-digit stored number from an E.164 inbound From', () => {
    // e.g. Twilio sends +16232039328, homeowner stored as 6232039328 (Joe's batch)
    const c = phoneMatchCandidates('+16232039328')
    expect(c).toContain('6232039328')
    expect(c).toContain('+16232039328')
  })

  it('matches an E.164 stored number from the same inbound (Marshall\'s batch)', () => {
    const c = phoneMatchCandidates('+15208486439')
    expect(c).toContain('+15208486439')
    expect(c).toContain('5208486439')
  })

  it('works when the inbound itself is bare 10-digit', () => {
    const c = phoneMatchCandidates('6232039328')
    expect(c).toContain('+16232039328')
    expect(c).toContain('6232039328')
    expect(c).toContain('16232039328')
  })

  it('strips formatting like (623) 363-8368', () => {
    const c = phoneMatchCandidates('(623) 363-8368')
    expect(c).toContain('6233638368')
    expect(c).toContain('+16233638368')
  })

  it('returns empty for junk / missing input', () => {
    expect(phoneMatchCandidates('')).toEqual([])
    expect(phoneMatchCandidates(null)).toEqual([])
    expect(phoneMatchCandidates(undefined)).toEqual([])
  })
})
