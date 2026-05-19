import { NextResponse, type NextRequest } from 'next/server';

/**
 * Security headers — Content-Security-Policy + standard hardening.
 *
 * The CSP is intentionally strict for a privacy-first markdown product:
 * - `default-src 'self'` blocks any third-party origin we don't explicitly allowlist
 * - `connect-src 'self' ws: wss: blob: stun:` permits the local WebRTC handshake,
 *   the hub (if configured to point at localhost), and y-webrtc signaling servers
 * - `img-src 'self' data: blob: https:` allows ingested-image previews + remote
 *   icons (lucide ships SVG inline so no special allowance needed)
 * - `style-src 'self' 'unsafe-inline'` is required by Next.js's hydration shim;
 *   when Tailwind v4 + Next 16 + nonces stabilize we drop the `'unsafe-inline'`
 * - `script-src 'self'` blocks all third-party scripts. Next inlines its own
 *   bootstrap with a nonce when this header is present.
 *
 * Tighten further once the editor's bundle is fully self-hosted (no jsdelivr,
 * no Google Fonts).
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob:",
  "connect-src 'self' ws: wss: blob: https://stun.l.google.com:19302",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

export function middleware(_request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set('Content-Security-Policy', CSP);
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(self), geolocation=(), browsing-topics=()',
  );

  return response;
}

export const config = {
  matcher: [
    // Run on every route except Next.js internals + static assets.
    '/((?!_next/static|_next/image|favicon.ico|icon-.*\\.png|.*\\.svg).*)',
  ],
};
