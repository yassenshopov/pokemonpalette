/**
 * IndexNow client.
 *
 * IndexNow is a free protocol where you ping a single endpoint and
 * Bing / Yandex / Seznam / Naver all re-crawl the URLs you submit. It
 * works in two halves:
 *
 *   1. You host a key file at `https://<host>/<key>.txt` whose body is
 *      just the key. This proves you control the domain.
 *   2. You POST a JSON payload to `api.indexnow.org/indexnow` with
 *      `{ host, key, keyLocation, urlList }` whenever URLs change.
 *
 * Both halves are public — the key isn't a secret; it just lets the
 * search engine cross-check that whoever's submitting URLs also
 * controls the domain. Committing the key (and the .txt file) directly
 * is the intended use.
 *
 * Why we care: Bing reports we're at 951 indexed URLs, 32.6K
 * impressions, 2.3K clicks per 6 months — meaningful traffic on its
 * own, and Bing's index now powers ChatGPT search + Copilot. Faster
 * re-crawl translates to: new Pokémon pages, the daily puzzle
 * (which the meta refreshes daily), and our new landing pages showing
 * up faster in those surfaces.
 *
 * Failure mode: this is best-effort. The submit helper never throws —
 * a failed ping is logged at WARN and that's it. We do not block any
 * user-facing action on IndexNow availability.
 */

import { logger } from "@/lib/logger";

/**
 * Domain key. The matching file is served at
 * `public/<INDEXNOW_KEY>.txt` so Bing/Yandex can verify ownership.
 *
 * This is intentionally public — keys ARE public in the IndexNow
 * protocol. Changing it requires also moving the matching .txt file
 * under `public/`.
 */
export const INDEXNOW_KEY = "7c4e9a2b8d6f15039e1a4c7b2d5e8f1a";

const SITE_HOST = "www.pokemonpalette.com";
const SITE_ORIGIN = `https://${SITE_HOST}`;
const KEY_LOCATION = `${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`;

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

/**
 * IndexNow limits a single submission to 10,000 URLs. We chunk
 * defensively even though no current caller comes close — the cap is a
 * hard 400 otherwise.
 */
const MAX_URLS_PER_REQUEST = 10_000;

export interface SubmitResult {
  ok: boolean;
  /** Last HTTP status observed; 0 on network error. */
  status: number;
  /** Total URLs successfully submitted across chunks. */
  submitted: number;
}

/**
 * Normalize incoming paths/URLs to canonical absolute URLs under our
 * domain. Accepts either form so callers don't have to remember which.
 *
 * Returns `null` for inputs that resolve outside our host — IndexNow
 * rejects mixed-host payloads with a 422.
 */
function toCanonicalUrl(input: string): string | null {
  if (!input) return null;
  try {
    const url = new URL(input, SITE_ORIGIN);
    if (url.host !== SITE_HOST) return null;
    // Strip fragments — IndexNow ignores them and we don't want a
    // bunch of "URL?ref=…#anchor" variants polluting the submit list.
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Submit a batch of URLs to IndexNow. Returns a structured result for
 * callers that want to log/track; never throws.
 *
 * Pass either paths (`"/game"`) or full URLs. Cross-host inputs are
 * silently dropped.
 */
export async function submitToIndexNow(
  urls: readonly string[],
): Promise<SubmitResult> {
  const dedup = new Set<string>();
  for (const raw of urls) {
    const canonical = toCanonicalUrl(raw);
    if (canonical) dedup.add(canonical);
  }
  const all = Array.from(dedup);
  if (all.length === 0) {
    return { ok: true, status: 200, submitted: 0 };
  }

  let lastStatus = 0;
  let submitted = 0;
  for (let i = 0; i < all.length; i += MAX_URLS_PER_REQUEST) {
    const chunk = all.slice(i, i + MAX_URLS_PER_REQUEST);
    try {
      const res = await fetch(INDEXNOW_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          host: SITE_HOST,
          key: INDEXNOW_KEY,
          keyLocation: KEY_LOCATION,
          urlList: chunk,
        }),
      });
      lastStatus = res.status;
      // 200 = accepted, 202 = accepted (async). 400/403/422/429 = our
      // problem; log so we notice repeated failures in Vercel logs.
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        logger.warn("indexnow.submit_rejected", {
          status: res.status,
          count: chunk.length,
          body: body.slice(0, 200),
        });
        // Don't bail — try subsequent chunks anyway, the failure may be
        // chunk-local (one URL flagged as malformed, etc.).
        continue;
      }
      submitted += chunk.length;
    } catch (err) {
      lastStatus = 0;
      logger.warn("indexnow.submit_network_error", {
        count: chunk.length,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    ok: submitted > 0,
    status: lastStatus,
    submitted,
  };
}

/**
 * Fire-and-forget variant for hot paths (admin mutations, etc.) where
 * we don't want to make the user wait on a third-party endpoint.
 * Schedules the submit on the next tick and never returns a promise to
 * the caller.
 */
export function submitToIndexNowAsync(urls: readonly string[]): void {
  // Captured at call time so callers can pass a transient array.
  const snapshot = Array.from(urls);
  // Microtask boundary — pushes the work off the response-critical
  // path without depending on Node's `setImmediate` (which Vercel's
  // Edge runtime doesn't have).
  void Promise.resolve().then(() => submitToIndexNow(snapshot));
}

/**
 * Canonical URL list that benefits from a daily re-crawl. Public so
 * the cron route and any future surface (e.g. an admin "ping
 * everything" button) share one source of truth.
 *
 *  - `/`            home content rotates with featured Pokémon
 *  - `/game`        the daily puzzle target + meta change every UTC
 *                   midnight via the new weekly-pool rotation
 *  - `/explore`     featured palettes rotate on the homepage
 *  - `/guess-the-pokemon`
 *                   our top-keyword landing; daily ping keeps it warm
 *                   in Bing's index while it builds traction
 */
export const DAILY_PING_URLS: readonly string[] = [
  `${SITE_ORIGIN}/`,
  `${SITE_ORIGIN}/game`,
  `${SITE_ORIGIN}/explore`,
  `${SITE_ORIGIN}/guess-the-pokemon`,
];
