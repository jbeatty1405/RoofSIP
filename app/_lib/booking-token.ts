import { createHmac, timingSafeEqual } from 'crypto'

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET
  if (!s) throw new Error('NEXTAUTH_SECRET is required for booking-token signing')
  return s
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

export function signBookingToken(pendingId: string): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS
  const payload = `${pendingId}.${expiresAt}`
  const sig = createHmac('sha256', secret()).update(payload).digest()
  return `${payload}.${b64url(sig)}`
}

export function verifyBookingToken(token: string): { pendingId: string } | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [pendingId, expiresAtStr, sigPart] = parts
  const expiresAt = parseInt(expiresAtStr, 10)
  if (!pendingId || !Number.isFinite(expiresAt)) return null
  if (Date.now() > expiresAt) return null

  const expected = createHmac('sha256', secret()).update(`${pendingId}.${expiresAt}`).digest()
  let provided: Buffer
  try {
    provided = fromB64url(sigPart)
  } catch {
    return null
  }
  if (provided.length !== expected.length) return null
  if (!timingSafeEqual(provided, expected)) return null

  return { pendingId }
}
