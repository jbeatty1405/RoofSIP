import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\s/g, ''),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.replace(/\s/g, ''),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/signup')
  const isApiRoute = pathname.startsWith('/api')
  const isPublicRoute =
    pathname === '/' ||
    // password reset happens while signed out, by definition
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/consent') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/terms') ||
    // Google Play requires a publicly reachable account-deletion page,
    // so this one must resolve while signed out
    pathname.startsWith('/delete-account') ||
    // Google Search Console ownership proof for the Play Console org check.
    // The matcher below only exempts _next/static, so a file in public/ still
    // runs through this gate and would 307 to /login for Google's crawler.
    // Search Console requires it to stay reachable AFTER verifying, not just once.
    pathname.startsWith('/google5ff0ea43ce604a0b.html') ||
    // metadata image routes must stay public so link previews unfurl
    pathname.startsWith('/opengraph-image') ||
    pathname.startsWith('/twitter-image') ||
    pathname.startsWith('/icon') ||
    pathname.startsWith('/apple-icon')

  if (!user && !isAuthRoute && !isApiRoute && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
