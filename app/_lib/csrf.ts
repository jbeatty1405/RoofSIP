import { NextRequest } from 'next/server'

export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true // same-origin browser requests often omit Origin
  try {
    return new URL(origin).host === new URL(request.url).host
  } catch {
    return false
  }
}
