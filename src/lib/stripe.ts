import Stripe from "stripe";
import { serverEnv } from "@/lib/env";

const globalForStripe = globalThis as unknown as {
  stripe?: Stripe;
};

/**
 * Pinned Stripe API version. Stripe documents that the active version
 * is locked at the account level and that an unpinned SDK call uses
 * whatever default the account is on — which silently shifts as
 * Stripe rolls accounts forward. Pinning here gives us:
 *   1. Deterministic shape of `event.data.object` across deploys —
 *      critical for the checkout webhook handler that destructures
 *      a `Checkout.Session`.
 *   2. A single source of truth for the version contract; bumping is
 *      a deliberate code change that's reviewed alongside any handler
 *      adjustments.
 * Bump this in lockstep with @types/stripe / `stripe` upgrades.
 */
const STRIPE_API_VERSION = "2026-04-22.dahlia" as const;

function getStripe(): Stripe {
  if (globalForStripe.stripe) return globalForStripe.stripe;
  const key = serverEnv.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  const client = new Stripe(key, {
    typescript: true,
    apiVersion: STRIPE_API_VERSION,
  });
  if (serverEnv.NODE_ENV !== "production") {
    globalForStripe.stripe = client;
  }
  return client;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(getStripe(), prop, receiver);
  },
});
