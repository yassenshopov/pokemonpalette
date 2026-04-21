import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import {
  softDeleteUser,
  syncUserFromClerk,
  type ClerkUserPayload,
} from "@/lib/user-service";
import { logger } from "@/lib/logger";

/**
 * Clerk webhook handler.
 *
 * Responsibilities:
 *   1. Verify the svix signature — non-negotiable. Without this anyone can
 *      POST a fake event and own our users table.
 *   2. Dispatch user.{created,updated,deleted} through `user-service` so
 *      every call site goes through the same canonical sync path.
 *
 * Logging notes:
 *   - NEVER log email addresses, names, metadata, or raw Clerk payloads.
 *     These are PII and end up in Vercel's log pipeline.
 *   - The previous implementation logged a happy-path emoji soup; it's
 *     replaced with the structured logger.
 */

type ClerkWebhookEvent = {
  type: string;
  data: ClerkUserPayload;
};

export async function POST(req: NextRequest) {
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    logger.warn("webhook.clerk.missing_svix_headers");
    return new Response("Missing svix headers", { status: 400 });
  }

  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    logger.error("webhook.clerk.secret_missing");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const payload = await req.text();

  let evt: ClerkWebhookEvent;
  try {
    const wh = new Webhook(secret);
    evt = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
  } catch {
    // Signature verification failure is the single most valuable failure
    // mode to log. But we don't leak the reason to avoid tipping off
    // attackers whether the timestamp or signature specifically failed.
    logger.warn("webhook.clerk.signature_invalid");
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  const eventType = evt.type;
  const userId = evt.data?.id;
  logger.info("webhook.clerk.received", { eventType, userId });

  try {
    switch (eventType) {
      case "user.created":
      case "user.updated":
        await syncUserFromClerk(evt.data);
        break;
      case "user.deleted":
        if (userId) await softDeleteUser(userId);
        break;
      default:
        logger.info("webhook.clerk.unhandled_event", { eventType });
    }

    return NextResponse.json({
      message: "Webhook processed successfully",
      eventType,
      userId,
    });
  } catch (err) {
    logger.error("webhook.clerk.processing_error", {
      eventType,
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return new Response("Error processing webhook", { status: 500 });
  }
}
