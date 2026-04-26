"use client";

import { Suspense, useEffect } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { useUser } from "@clerk/nextjs";
import { identify, setUserProperties, track } from "@/lib/analytics";

// IMPORTANT: this file is split into two exports because `useUser()` from
// Clerk throws if it can't find a `ClerkProvider` ancestor. Our layout only
// mounts the provider when the publishable key is configured, so the
// identity-tracking piece has to be rendered inside that conditional branch
// — see `<GoogleAnalyticsIdentity />` below. Everything else has no such
// dependency and lives in `<GoogleAnalytics />`.

/**
 * Mounts Google Analytics 4 and the supporting trackers we layer on top of
 * it. This is the *only* place that injects the gtag script — everywhere
 * else uses the helpers in `@/lib/analytics` to fire events.
 *
 * What this gives us beyond the previous inline-in-layout snippet:
 *
 * 1. SPA page views. The App Router doesn't trigger full reloads, so the
 *    `gtag('config', ID)` call only fires once and you'd lose every
 *    subsequent navigation. `RouteChangeTracker` watches pathname + query
 *    and emits a `page_view` on each change.
 * 2. Web Vitals. Replaces what we used to get from `@vercel/speed-insights`
 *    by piping LCP/INP/CLS/FCP/TTFB into GA4 as `web_vitals` events with
 *    the standard parameter names GA4's "Web Vitals" exploration expects.
 * 3. Outbound link tracking. A delegated click listener fires
 *    `outbound_click` for any link to a different host, so we can see what
 *    we're sending traffic to (Buy Me a Coffee, GitHub, etc.) without
 *    instrumenting each anchor.
 * Identity tracking lives in the sibling `<GoogleAnalyticsIdentity />`
 * export so it can be mounted inside the Clerk provider only when Clerk is
 * actually configured.
 *
 * The whole thing renders nothing if `NEXT_PUBLIC_GA4_ID` isn't set, which
 * keeps preview deployments and local dev clean by default.
 */
export function GoogleAnalytics({ measurementId }: { measurementId?: string }) {
  if (!measurementId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          // send_page_view: false — we emit page_view ourselves on every
          // App Router navigation (initial + SPA). Letting GA4 send its own
          // would double-count the first hit.
          gtag('config', '${measurementId}', {
            send_page_view: false,
            transport_type: 'beacon'
          });
        `}
      </Script>

      {/* useSearchParams() forces a Suspense boundary in App Router. */}
      <Suspense fallback={null}>
        <RouteChangeTracker />
      </Suspense>
      <WebVitalsReporter />
      <OutboundLinksTracker />
    </>
  );
}

/**
 * Mirrors Clerk auth state into GA4 as a `user_id` plus a stable
 * `is_signed_in` user property. Must be rendered inside `<ClerkProvider>`
 * — `useUser()` throws otherwise — which is why this is a separate export
 * from `<GoogleAnalytics />`.
 */
export function GoogleAnalyticsIdentity() {
  return <IdentityTracker />;
}

/**
 * Fires `page_view` on the initial render and on every subsequent App Router
 * navigation. Splitting pathname / search params means we capture query
 * changes (e.g. `/?pokemon=pikachu`) too — important since most of this app's
 * state lives in the URL.
 */
function RouteChangeTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.gtag !== "function") return;
    const search = searchParams?.toString();
    const url = pathname + (search ? `?${search}` : "");
    window.gtag("event", "page_view", {
      page_location: window.location.origin + url,
      page_path: pathname,
      page_title: document.title,
    });
  }, [pathname, searchParams]);

  return null;
}

/**
 * Forwards Core Web Vitals into GA4. The metric shape and parameter names
 * match what GA4's built-in Web Vitals report expects (id, value, rating)
 * so the data lights up the standard exploration without extra config.
 *
 * `value` is rounded — for CLS we multiply by 1000 because GA4 only stores
 * integers for event params and CLS is otherwise lost in rounding.
 */
function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    track("web_vitals", {
      metric_name: metric.name,
      metric_id: metric.id,
      metric_value: Math.round(
        metric.name === "CLS" ? metric.value * 1000 : metric.value,
      ),
      metric_rating: metric.rating,
      metric_delta: Math.round(
        metric.name === "CLS" ? metric.delta * 1000 : metric.delta,
      ),
      navigation_type: metric.navigationType,
    });
  });
  return null;
}

/**
 * Catches every click on an anchor that points to a different host and
 * emits `outbound_click`. Cheap to keep — one delegated listener on
 * document, no per-link wiring required.
 */
function OutboundLinksTracker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;

      // Only treat absolute URLs to a different host as outbound. Relative
      // links, anchors, mailto: / tel: are handled elsewhere or not
      // interesting for this metric.
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      if (url.host === window.location.host) return;

      track("outbound_click", {
        url: url.href,
        host: url.host,
        path: url.pathname,
        link_text: (anchor.textContent ?? "").trim().slice(0, 100),
      });
    };
    document.addEventListener("click", handler, { capture: true });
    return () => document.removeEventListener("click", handler, { capture: true });
  }, []);
  return null;
}

/**
 * Mirrors Clerk auth state into GA4 as a `user_id` plus a stable
 * `is_signed_in` user property. Lets dashboards segment by signed-in vs.
 * anonymous without each event having to carry the flag.
 *
 * Must run inside a `<ClerkProvider>` ancestor. See the file-level note.
 */
function IdentityTracker() {
  const { isLoaded, isSignedIn, user } = useUser();
  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && user?.id) {
      identify(user.id);
      setUserProperties({ is_signed_in: true });
    } else {
      identify(null);
      setUserProperties({ is_signed_in: false });
    }
  }, [isLoaded, isSignedIn, user?.id]);
  return null;
}
