// Single source of truth for the app's public base URL.
// Local dev sets NEXTAUTH_URL=http://localhost:3000 (truthy -> used).
// Production has NEXTAUTH_URL="" (empty/falsy -> falls back to the live URL),
// so absolute links in emails and OAuth redirects always resolve.
export const APP_URL = (process.env.NEXTAUTH_URL || 'https://roofsip.vercel.app').replace(/\/$/, '')
