import { NextRequest, NextResponse, after } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { generateKey } from "@/lib/api-keys";
import { logger } from "@/lib/logger";
import { serverEnv } from "@/lib/env";
import { Resend } from "resend";

export const runtime = "nodejs";

const resend = new Resend(serverEnv.RESEND_API_KEY);

/**
 * Minimal HTML escape for values interpolated into outgoing email
 * bodies. Stripe webhook fulfillment surfaces `firstName` (free-form
 * Clerk user input) into a string-templated HTML email — without
 * escaping, an attacker controlling their own first name could land a
 * stored XSS into their own inbox, and the template is a hand-rolled
 * concat, not a vetted renderer.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type ApiKeyEmailParams = {
  to: string;
  firstName: string | null;
  plainKey: string;
};

function buildApiKeyEmail({ firstName, plainKey }: ApiKeyEmailParams): {
  subject: string;
  html: string;
} {
  const safeName = firstName ? ` ${escapeHtml(firstName.trim())}` : "";
  const safeKey = escapeHtml(plainKey);
  return {
    subject: "Your PokémonPalette API Key",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Your API Key is Ready!</h1>
        <p>Hi${safeName},</p>
        <p>Thanks for purchasing lifetime access to the PokémonPalette API. Here is your API key:</p>
        <div style="background: #f4f4f5; border-radius: 8px; padding: 16px; margin: 16px 0; font-family: monospace; word-break: break-all;">
          ${safeKey}
        </div>
        <p><strong>Save this key now</strong> — it will not be shown again.</p>
        <p>Usage:</p>
        <pre style="background: #18181b; color: #a1a1aa; padding: 16px; border-radius: 8px; overflow-x: auto;">curl -H "Authorization: Bearer ${safeKey}" \\
  https://www.pokemonpalette.com/api/v1/palettes/25</pre>
        <p>You can create additional keys and manage them at <a href="https://www.pokemonpalette.com/account?tab=api">your dashboard</a>.</p>
        <p>Happy building!<br/>The PokémonPalette Team</p>
      </div>
    `,
  };
}

export async function POST(req: NextRequest) {
  const secret = serverEnv.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    logger.error("billing.webhook.secret_missing");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const body = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    logger.warn("billing.webhook.signature_invalid");
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  logger.info("billing.webhook.received", { type: event.type, eventId: event.id });

  if (event.type !== "checkout.session.completed") {
    // Acknowledge unhandled events. Stripe needs a 2xx or it will retry
    // every event type forever.
    return NextResponse.json({ received: true });
  }

  const session = event.data.object;
  const userId = session.client_reference_id;

  if (!userId) {
    logger.error("billing.webhook.missing_client_reference_id", {
      eventId: event.id,
    });
    return new Response("Missing client_reference_id", { status: 400 });
  }

  // Idempotency: we gate the entire fulfillment behind an insert into
  // `processed_webhook_events`. The PK is (provider, event_id) so a
  // second delivery of the same Stripe event hits a unique violation
  // and short-circuits. CRUCIAL: this insert lives INSIDE the same
  // $transaction as the api_key create + api_customer upsert. Without
  // that, a retry could observe a half-completed previous attempt
  // (e.g. customer upserted but the key insert failed) and either
  // duplicate work or leave it half-done.
  let plainKey: string | null = null;
  let recipient: { email: string | null; firstName: string | null } | null =
    null;

  try {
    await prisma.$transaction(async (tx) => {
      try {
        await tx.processedWebhookEvent.create({
          data: {
            provider: "stripe",
            eventId: event.id,
            eventType: event.type,
          },
        });
      } catch (err) {
        // Prisma "Unique constraint failed" — replay. Throw a sentinel
        // we can detect outside the transaction to skip side-effects.
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code?: string }).code === "P2002"
        ) {
          throw new ReplayError();
        }
        throw err;
      }

      await tx.apiCustomer.upsert({
        where: { userId },
        create: {
          userId,
          stripeCustomerId: session.customer as string | null,
          stripeSessionId: session.id,
          amountCents: session.amount_total ?? 0,
          currency: session.currency ?? "usd",
          status: "active",
        },
        update: {
          stripeCustomerId: session.customer as string | null,
          stripeSessionId: session.id,
          status: "active",
          // Intentionally don't overwrite amountCents/currency/purchasedAt
          // on update — those represent the original transaction and a
          // replay of the same checkout shouldn't rewrite history. The
          // event_id dedupe above already prevents true replays, but if
          // Stripe fires a fresh session for the same user (e.g. they
          // re-paid) we still want the original purchase metadata.
        },
      });

      const { plain, hash, prefix } = generateKey();
      await tx.apiKey.create({
        data: { userId, keyHash: hash, keyPrefix: prefix, name: "Default" },
      });
      plainKey = plain;

      recipient = await tx.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true },
      });
    });
  } catch (err) {
    if (err instanceof ReplayError) {
      logger.info("billing.webhook.replay_ignored", {
        eventId: event.id,
        userId,
      });
      return NextResponse.json({ received: true, replayed: true });
    }
    logger.error("billing.webhook.fulfillment_failed", {
      userId,
      eventId: event.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return new Response("Fulfillment error", { status: 500 });
  }

  // Email send happens AFTER we've committed the fulfillment and AFTER
  // the response is sent back to Stripe. Stripe's webhook timeout is
  // tight (10s for the response) and Resend can occasionally take
  // seconds; awaiting it inline used to push us past the timeout,
  // which then triggered another delivery, which (pre-idempotency)
  // minted another key. With `after()` the email runs on the
  // serverless function's tail after the 200 is on the wire.
  const captured = recipient as { email: string | null; firstName: string | null } | null;
  if (captured?.email && plainKey && serverEnv.RESEND_API_KEY) {
    const targetEmail = captured.email;
    const targetFirstName = captured.firstName;
    const key = plainKey;
    after(async () => {
      const fromEmail =
        serverEnv.RESEND_FROM_EMAIL || "noreply@pokemonpalette.com";
      const fromName = serverEnv.RESEND_FROM_NAME || "PokémonPalette";
      const { subject, html } = buildApiKeyEmail({
        to: targetEmail,
        firstName: targetFirstName,
        plainKey: key,
      });
      try {
        await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: targetEmail,
          subject,
          html,
        });
        logger.info("billing.webhook.key_email_sent", { userId });
      } catch (err) {
        logger.error("billing.webhook.email_send_failed", {
          userId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  logger.info("billing.webhook.purchase_fulfilled", { userId, eventId: event.id });
  return NextResponse.json({ received: true });
}

/** Sentinel thrown inside the fulfillment transaction when the event
 *  has already been processed (PK conflict on processed_webhook_events).
 *  Caught by the outer handler to return a quiet 200. */
class ReplayError extends Error {
  constructor() {
    super("Replayed webhook event");
    this.name = "ReplayError";
  }
}
