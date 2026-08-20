import { describe, it, expect } from 'vitest'
import { isOptOutMessage, isOptBackInMessage, isOptedOut } from '@/app/_lib/opt-out'

describe('isOptOutMessage', () => {
  it('catches the bare keyword in any casing or punctuation', () => {
    // The real message that started this: a confirmed homeowner replied "Stop"
    // the day after a storm alert.
    for (const m of ['stop', 'Stop', 'STOP', 'STOP!', 'Stop.', ' stop ', 'STOP 🛑']) {
      expect(isOptOutMessage(m), m).toBe(true)
    }
  })

  it('catches the standard carrier keywords', () => {
    for (const m of ['unsubscribe', 'CANCEL', 'quit', 'end', 'stopall', 'opt out', 'revoke']) {
      expect(isOptOutMessage(m), m).toBe(true)
    }
  })

  it('catches an opt-out written as a sentence', () => {
    // These are the ones that used to fall through to the booking logic, which
    // texted the homeowner back and handed the PM a "call to reschedule" lead.
    for (const m of [
      'stop texting me',
      'Please stop sending me these',
      'take me off this list',
      'remove me please',
      'do not text me again',
      "don't text this number",
      'no more texts please',
      'unsubscribe me from this',
      'lose my number',
      'leave me alone',
    ]) {
      expect(isOptOutMessage(m), m).toBe(true)
    }
  })

  it('does not treat scheduling language as an opt-out', () => {
    // "stop by" is a homeowner booking an inspection. Silencing them would lose
    // the job and look like the opt-out bug in reverse.
    for (const m of [
      'can you have him stop by Tuesday',
      'sure, stop by around 3',
      'have Justin stop in when he can',
    ]) {
      expect(isOptOutMessage(m), m).toBe(false)
    }
  })

  it('does not treat a slot decline or a call preference as an opt-out', () => {
    // Verbatim from production — this homeowner wanted the texts and would have
    // been silenced by a looser matcher.
    for (const m of [
      "Tuesday afternoon \nDon't call \nJust let me know between 1 & 3 pm",
      'No',
      'that time does not work',
      'not this week',
      'yes',
    ]) {
      expect(isOptOutMessage(m), m).toBe(false)
    }
  })

  it('ignores empty input', () => {
    expect(isOptOutMessage('')).toBe(false)
    expect(isOptOutMessage(null)).toBe(false)
  })
})

describe('isOptBackInMessage', () => {
  it('accepts the standard opt-back-in keywords', () => {
    for (const m of ['start', 'START', 'unstop', 'Resume']) {
      expect(isOptBackInMessage(m), m).toBe(true)
    }
  })

  it('does not fire on start used in a sentence', () => {
    expect(isOptBackInMessage('when can you start the roof')).toBe(false)
  })
})

describe('isOptedOut', () => {
  it('flags a homeowner who confirmed by text and later stopped', () => {
    // The exact shape that read as a green "SMS active" badge: STOP clears
    // consent but deliberately leaves sms_confirmed alone.
    expect(isOptedOut({ tcpa_consent: false, tcpa_consent_at: null, sms_confirmed: true })).toBe(true)
  })

  it('flags a homeowner who consented at signup and later stopped', () => {
    expect(isOptedOut({ tcpa_consent: false, tcpa_consent_at: '2026-08-14T00:00:00Z', sms_confirmed: false })).toBe(true)
  })

  it('does not flag someone who simply never consented', () => {
    // A CSV import and a monitor-only home both rest at consent=false. Calling
    // those "opted out" would put a red do-not-text badge on most of the book.
    expect(isOptedOut({ tcpa_consent: false, tcpa_consent_at: null, sms_confirmed: false })).toBe(false)
  })

  it('does not flag an active homeowner', () => {
    expect(isOptedOut({ tcpa_consent: true, tcpa_consent_at: '2026-08-14T00:00:00Z', sms_confirmed: true })).toBe(false)
  })

  it('flags a monitor-only homeowner once opted_out_at is stamped', () => {
    // The case the inferred rule cannot see: a monitor-only home already rests
    // at consent=false with no consent date, so before this column a STOP from
    // them was honored but unlabelled.
    const monitorOnly = { tcpa_consent: false, tcpa_consent_at: null, sms_confirmed: false }
    expect(isOptedOut(monitorOnly)).toBe(false)
    expect(isOptedOut({ ...monitorOnly, opted_out_at: '2026-08-20T00:00:45Z' })).toBe(true)
  })

  it('stops flagging them once they text START and the stamp is cleared', () => {
    expect(isOptedOut({ tcpa_consent: true, tcpa_consent_at: '2026-08-20T01:00:00Z', sms_confirmed: true, opted_out_at: null })).toBe(false)
  })
})
