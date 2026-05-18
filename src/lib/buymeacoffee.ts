/**
 * Server-side Buy Me a Coffee supporter fetcher.
 *
 * Hits BMC's Personal Access Token API (https://developers.buymeacoffee.com)
 * for one-time tips (`/extras`) and recurring members (`/subscriptions`),
 * merges them by supporter name, and returns the top-N for the supporters
 * wall. The fetch is cached for 1 hour via Next.js's revalidate so we don't
 * hammer BMC on every page load.
 *
 * Token gating: if `BUYMEACOFFEE_TOKEN` is unset, the fetcher returns an
 * empty array silently — the SupportersDisplay component renders the
 * "Support the project" CTA without the avatar grid, so the page still
 * looks intentional in dev or before the token is configured.
 */

const BMC_BASE = "https://developers.buymeacoffee.com/api/v1";
const REVALIDATE_SECONDS = 60 * 60; // 1 hour

export interface Supporter {
  /** Display name. Falls back to "Anonymous" when BMC returns a null name. */
  name: string;
  /**
   * Total amount this supporter has contributed (one-time + recurring),
   * rounded to whole units of the supporter's currency.
   */
  amount: number;
  /**
   * "monthly" for active subscribers, "one-time" for tips. Surfaced so the
   * UI can label them differently if desired — current display does not.
   */
  kind: "monthly" | "one-time";
}

interface BmcExtra {
  supporter_name?: string | null;
  support_coffees?: number | null;
  support_coffee_price?: string | number | null;
  support_visibility?: number | null;
}

interface BmcSubscription {
  payer_name?: string | null;
  subscription_coffee_num?: number | null;
  subscription_coffee_price?: string | number | null;
  subscription_is_cancelled?: number | boolean | null;
  subscription_current_status?: string | null;
}

interface BmcListResponse<T> {
  data?: T[];
}

/**
 * Tip count × tip unit price. BMC stores both as strings on the API even
 * though they're numeric — coerce safely and ignore obvious garbage.
 */
function computeAmount(
  coffees: number | null | undefined,
  unitPrice: string | number | null | undefined,
): number {
  const count = typeof coffees === "number" ? coffees : 0;
  const priceNum =
    typeof unitPrice === "number"
      ? unitPrice
      : typeof unitPrice === "string"
        ? parseFloat(unitPrice)
        : 0;
  if (!Number.isFinite(priceNum) || priceNum <= 0) return 0;
  return Math.round(count * priceNum);
}

async function fetchBmc<T>(path: string, token: string): Promise<T[]> {
  const res = await fetch(`${BMC_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    next: { revalidate: REVALIDATE_SECONDS, tags: ["buymeacoffee"] },
  });
  if (!res.ok) {
    // Don't throw — supporters are a nice-to-have. Log to the server console
    // so the issue surfaces in Vercel logs without breaking page rendering.
    console.warn(
      `[buymeacoffee] ${path} returned ${res.status} ${res.statusText}`,
    );
    return [];
  }
  const json = (await res.json()) as BmcListResponse<T>;
  return json.data ?? [];
}

/**
 * Fetch and merge the supporter list. Returns at most `limit` supporters
 * sorted by total contribution descending.
 *
 * `BUYMEACOFFEE_TOKEN` must be a Personal Access Token created at
 * https://buymeacoffee.com/account/payouts → API tab. The token only needs
 * read scope.
 */
export async function fetchSupporters(limit = 16): Promise<Supporter[]> {
  const token = process.env.BUYMEACOFFEE_TOKEN;
  if (!token) return [];

  try {
    const [extras, subscriptions] = await Promise.all([
      fetchBmc<BmcExtra>("/extras?status=valid", token),
      fetchBmc<BmcSubscription>("/subscriptions?status=active", token),
    ]);

    // Merge by display name so one supporter who's both tipped and
    // subscribed shows up once, with their amounts summed.
    const byName = new Map<string, Supporter>();

    for (const extra of extras) {
      // BMC sets support_visibility=0 when the supporter chose to remain
      // anonymous on their public profile. Respect that.
      if (extra.support_visibility === 0) continue;
      const name = (extra.supporter_name ?? "").trim() || "Anonymous";
      const amount = computeAmount(
        extra.support_coffees,
        extra.support_coffee_price,
      );
      if (amount <= 0) continue;
      const existing = byName.get(name);
      if (existing) {
        existing.amount += amount;
      } else {
        byName.set(name, { name, amount, kind: "one-time" });
      }
    }

    for (const sub of subscriptions) {
      const cancelled =
        sub.subscription_is_cancelled === 1 ||
        sub.subscription_is_cancelled === true ||
        sub.subscription_current_status === "cancelled";
      if (cancelled) continue;
      const name = (sub.payer_name ?? "").trim() || "Anonymous";
      const amount = computeAmount(
        sub.subscription_coffee_num,
        sub.subscription_coffee_price,
      );
      if (amount <= 0) continue;
      const existing = byName.get(name);
      if (existing) {
        existing.amount += amount;
        existing.kind = "monthly"; // monthly wins for display labeling
      } else {
        byName.set(name, { name, amount, kind: "monthly" });
      }
    }

    return [...byName.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit);
  } catch (err) {
    console.warn("[buymeacoffee] fetchSupporters failed", err);
    return [];
  }
}
