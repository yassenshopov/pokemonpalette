import { NextResponse } from "next/server";

/**
 * Public-API CORS policy for `/api/v1/*`.
 *
 * Why these defaults:
 *   - `Allow-Origin: *` — the v1 palette API is a read-only public
 *     endpoint behind a per-customer Bearer key. Browser callers
 *     from arbitrary origins are explicitly part of the value
 *     proposition ("paste your key into Codepen / Storybook").
 *   - We deliberately do NOT echo a specific request `Origin` here
 *     because that requires `Vary: Origin` and a per-tenant allow-list
 *     we don't have. The wildcard is the safer baseline for now.
 *   - `Allow-Credentials` is intentionally NOT set. The v1 API auths
 *     via Bearer tokens, never cookies — `*` + credentials would be a
 *     spec violation and browsers would reject it anyway.
 *   - The 86400 max-age caches the preflight for a day so each call
 *     site only pays the OPTIONS round-trip once per browser session.
 */
export const PUBLIC_API_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

/** Apply CORS headers to an existing NextResponse. */
export function withPublicApiCors(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(PUBLIC_API_CORS_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}

/** Standard CORS preflight response. Caller wires this up as the
 *  route's `OPTIONS` export. */
export function publicApiPreflight(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: PUBLIC_API_CORS_HEADERS,
  });
}
