"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";

/**
 * Default AdSense publisher ID. Matches the entry in `public/ads.txt` so
 * Google's crawler can verify ownership. Override with the
 * `NEXT_PUBLIC_ADSENSE_CLIENT_ID` env var for staging / preview accounts.
 */
export const DEFAULT_ADSENSE_CLIENT_ID = "ca-pub-3531385911292759";

/**
 * Centralised slot IDs — populated via Vercel env vars once the ad units
 * are created in the AdSense dashboard.  When a slot is empty the
 * `<AdUnit>` component no-ops, so there are never broken `<ins>` tags.
 */
export const ADSENSE_SLOTS = {
  pokemonDetailInArticle: process.env.NEXT_PUBLIC_ADSENSE_SLOT_DETAIL ?? "",
  listingInFeed: process.env.NEXT_PUBLIC_ADSENSE_SLOT_LISTING ?? "",
  exploreInFeed: process.env.NEXT_PUBLIC_ADSENSE_SLOT_EXPLORE ?? "",
  // `/` — rendered only once the palette tool has produced a result, well
  // below the interactive area. Separate slot so RPM can be measured
  // independently of the SEO content pages.
  homeBelowTool: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME ?? "",
  // `/game` — rendered only on the post-game results screen, never during
  // gameplay or in multiplayer.
  gameResults: process.env.NEXT_PUBLIC_ADSENSE_SLOT_GAME ?? "",
};

const AD_DENIED_PREFIXES = ["/saved-palettes", "/account", "/api-access", "/admin", "/game"];

/**
 * Returns `false` for routes where ads should never render (tool home,
 * auth/account, admin, game).  Relies on `usePathname()` so it must be
 * called from a client component.
 */
export function useShouldRenderAds(): boolean {
  const pathname = usePathname();
  if (pathname === "/") return false;
  return !AD_DENIED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

declare global {
  interface Window {
    // AdSense uses a magic global array — pushing into it triggers the
    // loader to render the next un-filled <ins class="adsbygoogle"> on the
    // page. We type it loosely because Google ships no first-party types.
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

/**
 * Injects the Google AdSense Auto Ads loader once per document. This is the
 * only place that adds the `adsbygoogle.js` script tag — individual ad
 * placements use `<AdUnit />` (below) which assumes the loader is already
 * present.
 *
 * Behaviour notes:
 *
 * - Renders nothing when no client ID is resolvable. We pull from the
 *   `clientId` prop first, then `NEXT_PUBLIC_ADSENSE_CLIENT_ID`, then fall
 *   back to `DEFAULT_ADSENSE_CLIENT_ID`. The fallback means the script runs
 *   in production by default; preview deployments can opt out by setting
 *   `NEXT_PUBLIC_ADSENSE_CLIENT_ID=""`.
 * - Strategy is `afterInteractive` to avoid blocking hydration — same
 *   choice we made for GA4.
 * - `crossOrigin="anonymous"` mirrors the official AdSense snippet and is
 *   required for the loader to read its CORS-protected response correctly.
 * - SPA navigations don't reload the loader, but `<AdUnit />` re-pushes
 *   `adsbygoogle` on mount so each new placement still fills.
 */
export function GoogleAdSense({ clientId }: { clientId?: string }) {
  const resolvedClientId =
    clientId ??
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ??
    DEFAULT_ADSENSE_CLIENT_ID;

  if (!resolvedClientId) return null;

  return (
    <Script
      id="google-adsense"
      async
      strategy="afterInteractive"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${resolvedClientId}`}
      crossOrigin="anonymous"
    />
  );
}

type AdUnitProps = {
  /** AdSense ad slot ID (the numeric string from the unit in your AdSense dashboard). */
  slot: string;
  /**
   * Override the publisher client ID. Defaults to the same resolution
   * order as `<GoogleAdSense />` so most callers can omit this.
   */
  clientId?: string;
  /** AdSense format. Defaults to `auto` for responsive units. */
  format?: "auto" | "fluid" | "rectangle" | "vertical" | "horizontal";
  /** Whether to allow AdSense to pick a full-width responsive layout. */
  responsive?: boolean;
  /** Layout key for in-feed/in-article fluid units. */
  layout?: string;
  layoutKey?: string;
  /** Optional className applied to the surrounding container. */
  className?: string;
  /**
   * Inline style applied to the `<ins>` element. AdSense requires an
   * explicit display value (`block` for responsive, `inline-block` plus
   * sizing for fixed). Defaults to `{ display: "block" }`.
   */
  style?: React.CSSProperties;
  /**
   * Escape hatch to render on a deny-listed route (the home tool and
   * `/game`). Pass `true` only for deliberate, below-the-fold or
   * post-interaction placements that the global guard would otherwise
   * suppress. Routes that should *never* show ads (admin, account,
   * /game/pokedex, etc.) are not affected by this flag — they're
   * filtered by a separate, harder check elsewhere if added later.
   */
  allowOnDeniedRoute?: boolean;
};

/**
 * Renders a single AdSense ad slot. Drop this anywhere in the tree where
 * you want an ad to appear; the loader injected by `<GoogleAdSense />` in
 * the root layout takes care of filling it.
 *
 * Re-fills on:
 *
 * - Mount (initial render of the slot).
 * - Route change. App Router doesn't unmount components that survive a
 *   navigation, but the URL is what determines targeting and we want a new
 *   impression per page. We watch pathname + searchParams and re-push.
 *
 * Each push is wrapped in try/catch because the AdSense loader throws
 * synchronously when it can't fill (ad blocker, no inventory, duplicate
 * push during a single render cycle in dev's StrictMode double-invoke).
 * None of those are actionable from our side, and an uncaught error here
 * would take down the whole React tree.
 */
export function AdUnit({
  slot,
  clientId,
  format = "auto",
  responsive = true,
  layout,
  layoutKey,
  className,
  style,
  allowOnDeniedRoute = false,
}: AdUnitProps) {
  const resolvedClientId =
    clientId ??
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ??
    DEFAULT_ADSENSE_CLIENT_ID;

  const adsAllowed = useShouldRenderAds() || allowOnDeniedRoute;
  const pathname = usePathname();
  const pushedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!resolvedClientId || !slot || !adsAllowed) return;
    if (typeof window === "undefined") return;
    if (pushedKeyRef.current === pathname) return;
    pushedKeyRef.current = pathname;
    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    } catch {
      // Swallow — ad blockers, duplicate pushes, and missing inventory
      // all surface here and none of them are recoverable client-side.
    }
  }, [pathname, resolvedClientId, slot, adsAllowed]);

  if (!resolvedClientId || !slot || !adsAllowed) return null;

  // Google's official fluid (in-article / in-feed) snippet omits
  // `data-full-width-responsive` entirely — it only applies to the
  // `auto` display format. Keeping it on a fluid unit doesn't break
  // anything but emits a console warning and drifts from the template
  // AdSense expects when matching unit configuration to served HTML.
  const isFluid = format === "fluid";

  return (
    <div className={className} aria-hidden="true">
      <ins
        className="adsbygoogle"
        style={style ?? { display: "block" }}
        data-ad-client={resolvedClientId}
        data-ad-slot={slot}
        data-ad-format={format}
        {...(isFluid
          ? {}
          : { "data-full-width-responsive": responsive ? "true" : "false" })}
        {...(layout ? { "data-ad-layout": layout } : {})}
        {...(layoutKey ? { "data-ad-layout-key": layoutKey } : {})}
      />
    </div>
  );
}
