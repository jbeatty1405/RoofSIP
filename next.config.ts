import type { NextConfig } from "next";

// Applied to every response. Deliberately does NOT set a script-src/style-src CSP:
// Next injects inline bootstrap scripts and Stripe/Supabase load at runtime, so a
// real content policy needs nonce plumbing through the root layout. That is its own
// change. `frame-ancestors` is the half that carries no such risk, so it ships now
// and does the same job as X-Frame-Options for browsers that honour CSP.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Verified unused across app/ and components/ before locking these off.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
