import type { MetadataRoute } from 'next'

const BASE = 'https://roofsip.vercel.app'

// Only pages that resolve while signed out — the public allow-list in proxy.ts.
// /consent is deliberately absent: it is a per-homeowner flow page, not content.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: BASE, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/signup`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/delete-account`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
