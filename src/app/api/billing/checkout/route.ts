import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function POST() {
  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId;
  } catch {
    return NextResponse.json(
      { error: "Authentication service unavailable" },
      { status: 503 },
    );
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.apiCustomer.findUnique({
    where: { userId },
  });
  if (existing?.status === "active") {
    return NextResponse.json(
      { error: "You already have API access" },
      { status: 409 },
    );
  }

  const priceId = process.env.STRIPE_PALETTE_API_PRICE_ID;
  if (!priceId) {
    logger.error("billing.checkout.missing_price_id");
    return NextResponse.json(
      { error: "Billing is not configured" },
      { status: 500 },
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.pokemonpalette.com";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,
      success_url: `${baseUrl}/account?tab=api&purchase=success`,
      cancel_url: `${baseUrl}/account?tab=api&purchase=cancel`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    logger.error("billing.checkout.session_create_failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
