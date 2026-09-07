import type { MetadataRoute } from 'next'

const BASE = 'https://roofsip.vercel.app'

// Everything not listed as public in proxy.ts 307s to /login, so crawling those
// paths just burns budget on a redirect. Disallow them explicitly rather than
// letting a crawler discover the login wall one URL at a time.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/dashboard/', '/admin/', '/booking/', '/subscribe/', '/support/'],
    },
    sitemap: `${BASE}/sitemap.xml`,
  }
}
