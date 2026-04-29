"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";

/**
 * Fires a one-shot POST /api/me/geo when the user first appears as
 * authenticated. The server route reads Vercel's edge geo headers and
 * stores the country code + timezone on the user row so the admin
 * "Insights" map can show audience distribution.
 *
 * Why a client ping rather than a webhook or middleware?
 *
 *   - Clerk webhooks don't include geo headers (Clerk hosts the auth flow
 *     so its IP, not the user's, would be captured).
 *   - The site's middleware is scoped narrowly to `/api`, `/account`, and
 *     `/admin` for caching reasons (see `src/middleware.ts`). We don't
 *     want to widen that just to capture geo.
 *   - A one-shot client ping piggy-backs on a real user request, so the
 *     edge headers are accurate and the write is rate-limited by the
 *     30-day throttle on the server.
 *
 * Must run inside `<ClerkProvider>` — `useUser()` throws otherwise.
 * Renders nothing.
 */
export function GeoCapture() {
  const { isLoaded, isSignedIn, user } = useUser();
  const sentForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id) return;

    // Once per session per user. The server still rate-limits to 30d so
    // even if this fired on every navigation the impact would be a
    // single SELECT, but checking here avoids the round trip entirely.
    if (sentForRef.current === user.id) return;
    sentForRef.current = user.id;

    const controller = new AbortController();
    // Defer slightly so we don't compete with the initial paint.
    const id = window.setTimeout(() => {
      fetch("/api/me/geo", {
        method: "POST",
        signal: controller.signal,
        keepalive: true,
        headers: { "content-type": "application/json" },
      }).catch(() => {
        // Network errors are non-fatal — the next session will retry.
      });
    }, 1500);

    return () => {
      window.clearTimeout(id);
      controller.abort();
    };
  }, [isLoaded, isSignedIn, user?.id]);

  return null;
}
