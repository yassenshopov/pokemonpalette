import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { generateKey } from "@/lib/api-keys";
import { logger } from "@/lib/logger";
import { Resend } from "resend";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
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

  logger.info("billing.webhook.received", { type: event.type });

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.client_reference_id;

    if (!userId) {
      logger.error("billing.webhook.missing_client_reference_id");
      return new Response("Missing client_reference_id", { status: 400 });
    }

    try {
      await prisma.apiCustomer.upsert({
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
          amountCents: session.amount_total ?? 0,
          currency: session.currency ?? "usd",
          status: "active",
          purchasedAt: new Date(),
        },
      });

      const { plain, hash, prefix } = generateKey();
      await prisma.apiKey.create({
        data: { userId, keyHash: hash, keyPrefix: prefix, name: "Default" },
      });

      // Send the API key via email
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true },
      });

      if (user?.email && process.env.RESEND_API_KEY) {
        const fromEmail =
          process.env.RESEND_FROM_EMAIL || "noreply@pokemonpalette.com";
        const fromName = process.env.RESEND_FROM_NAME || "PokémonPalette";

        await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: user.email,
          subject: "Your PokémonPalette API Key",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #333;">Your API Key is Ready!</h1>
              <p>Hi${user.firstName ? ` ${user.firstName}` : ""},</p>
              <p>Thanks for purchasing lifetime access to the PokémonPalette API. Here is your API key:</p>
              <div style="background: #f4f4f5; border-radius: 8px; padding: 16px; margin: 16px 0; font-family: monospace; word-break: break-all;">
                ${plain}
              </div>
              <p><strong>Save this key now</strong> — it will not be shown again.</p>
              <p>Usage:</p>
              <pre style="background: #18181b; color: #a1a1aa; padding: 16px; border-radius: 8px; overflow-x: auto;">curl -H "Authorization: Bearer ${plain}" \\
  https://www.pokemonpalette.com/api/v1/palettes/25</pre>
              <p>You can create additional keys and manage them at <a href="https://www.pokemonpalette.com/account?tab=api">your dashboard</a>.</p>
              <p>Happy building!<br/>The PokémonPalette Team</p>
            </div>
          `,
        }).catch((err) => {
          logger.error("billing.webhook.email_send_failed", {
            userId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }

      logger.info("billing.webhook.purchase_fulfilled", { userId });
    } catch (err) {
      logger.error("billing.webhook.fulfillment_failed", {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
      return new Response("Fulfillment error", { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
