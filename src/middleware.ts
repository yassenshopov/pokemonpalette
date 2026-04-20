import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware();

// IMPORTANT: we deliberately scope this to routes that actually read auth on
// the server (API routes, /account, /admin). Public HTML pages like /[name],
// /shiny/[name], /game, /explore, /type, /rarity, /generation are fully SSG
// and MUST NOT run through Clerk middleware or Vercel will mark the edge
// response as uncacheable (Clerk attaches no-cache + Set-Cookie), turning our
// ~1,350 statically generated Pokemon pages into a per-request function call.
// Clerk's client SDK (useUser, SignInButton, etc.) still works on those pages
// because it talks directly to Clerk's hosted endpoints from the browser.
export const config = {
  matcher: [
    '/(api|trpc)(.*)',
    '/account/:path*',
    '/admin/:path*',
  ],
};
