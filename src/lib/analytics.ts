/**
 * Thin client-side wrapper around Google Analytics 4 (gtag.js).
 *
 * Goals:
 * - Drop-in replacement for the `track(name, props)` shape we used with
 *   Vercel Analytics, so existing callsites don't all need to be rewritten.
 * - SSR-safe: every export is callable from server components / RSC files
 *   without throwing. Server calls just no-op (gtag only exists in the
 *   browser).
 * - Defensive: never throws on invalid/missing config. Analytics breaking
 *   the app is the worst possible failure mode for an analytics layer.
 *
 * The actual GA4 script is injected once by `<GoogleAnalytics />` (see
 * `src/components/analytics/google-analytics.tsx`). Everything in this file
 * just talks to the global `window.gtag` it sets up.
 */

type Primitive = string | number | boolean | null | undefined;
type Props = Record<string, Primitive>;

declare global {
  interface Window {
    // gtag's real signature is variadic and overloaded; we narrow to the two
    // shapes we actually call.
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/**
 * Sanitize an event name to GA4's allowed character set:
 * letters, digits, and underscores; must start with a letter; max 40 chars.
 *
 * GA4 silently drops events with invalid names, so we coerce here instead of
 * forcing every callsite to think about it. We keep the original `track()`
 * names from the Vercel-Analytics era (snake_case already) so this is a
 * no-op for current code.
 */
function sanitizeEventName(name: string): string {
  let cleaned = name.replace(/[^a-zA-Z0-9_]/g, "_");
  if (!/^[a-zA-Z]/.test(cleaned)) {
    cleaned = `e_${cleaned}`;
  }
  return cleaned.slice(0, 40);
}

/**
 * Sanitize event parameters to GA4's accepted shape:
 * - Param keys: <=40 chars, [a-zA-Z0-9_], must start with a letter.
 * - Param values: string (<=100 chars) or number/boolean. We coerce other
 *   types to strings so callers don't have to.
 * - Up to 25 params per event (we trim quietly rather than reject).
 */
function sanitizeProps(props?: Props): Record<string, string | number | boolean> | undefined {
  if (!props) return undefined;
  const out: Record<string, string | number | boolean> = {};
  let count = 0;
  for (const [rawKey, rawValue] of Object.entries(props)) {
    if (count >= 25) break;
    if (rawValue === null || rawValue === undefined) continue;
    let key = rawKey.replace(/[^a-zA-Z0-9_]/g, "_");
    if (!/^[a-zA-Z]/.test(key)) key = `p_${key}`;
    key = key.slice(0, 40);

    let value: string | number | boolean;
    if (typeof rawValue === "number" || typeof rawValue === "boolean") {
      value = rawValue;
    } else {
      value = String(rawValue).slice(0, 100);
    }
    out[key] = value;
    count++;
  }
  return out;
}

/**
 * Send a custom event to GA4.
 *
 * Mirrors the `track(eventName, properties)` shape we used with
 * `@vercel/analytics`, so migrating imports is a one-line change.
 *
 * Safe to call from anywhere — on the server it no-ops; in the browser it
 * waits politely for `window.gtag` (the script may still be loading).
 */
export function track(eventName: string, props?: Props): void {
  if (typeof window === "undefined") return;
  try {
    const name = sanitizeEventName(eventName);
    const params = sanitizeProps(props);

    // If gtag isn't ready yet, push directly onto dataLayer — the gtag
    // bootstrap snippet replays it on init, so nothing is lost during the
    // small window before the script finishes loading.
    if (typeof window.gtag === "function") {
      window.gtag("event", name, params ?? {});
    } else {
      window.dataLayer = window.dataLayer ?? [];
      window.dataLayer.push({ event: name, ...(params ?? {}) });
    }
  } catch {
    // Analytics must never break the app. Swallow.
  }
}

/**
 * Track a page view. Called by `<GoogleAnalytics />` on route changes; rare
 * to need this from app code, but exposed for completeness.
 */
export function pageview(url: string, title?: string): void {
  if (typeof window === "undefined") return;
  if (typeof window.gtag !== "function") return;
  try {
    window.gtag("event", "page_view", {
      page_location: url,
      page_path: new URL(url, window.location.origin).pathname,
      page_title: title ?? document.title,
    });
  } catch {
    // noop
  }
}

/**
 * Set a user property on the current session (e.g. `is_signed_in: true`).
 * GA4 user properties survive across events for the same client, which is
 * what you want for slicing dashboards by stable attributes.
 */
export function setUserProperties(props: Props): void {
  if (typeof window === "undefined") return;
  if (typeof window.gtag !== "function") return;
  const params = sanitizeProps(props);
  if (!params) return;
  try {
    window.gtag("set", "user_properties", params);
  } catch {
    // noop
  }
}

/**
 * Identify the signed-in user. GA4's `user_id` lets you stitch sessions
 * across devices for logged-in users; nothing identifying is stored, just
 * the opaque ID you pass in (use Clerk's user.id, not email).
 */
export function identify(userId: string | null): void {
  if (typeof window === "undefined") return;
  if (typeof window.gtag !== "function") return;
  try {
    window.gtag("set", { user_id: userId ?? undefined });
  } catch {
    // noop
  }
}
