import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { z } from "zod";
import {
  softDeleteUser,
  syncUserFromClerk,
  type ClerkUserPayload,
} from "@/lib/user-service";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { serverEnv } from "@/lib/env";

// Loose Zod schema for the Clerk webhook envelope. We validate the
// shape we depend on (top-level `type`, `data.id`) without locking
// down every optional field — Clerk adds fields all the time and we
// don't want a benign new field to brick the webhook. Anything we
// actively read from `data.*` is in `ClerkUserPayload` and is checked
// at the call site (e.g. `syncUserFromClerk`).
const ClerkWebhookSchema = z.object({
  type: z.string().min(1),
  data: z
    .object({
      id: z.string().min(1).optional(),
    })
    .passthrough(),
});

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

/** Narrow svix's verified-but-untyped payload to our schema. Throws
 *  on schema mismatch — caller treats this as a malformed delivery. */
function parseWebhookEvent(raw: unknown): ClerkWebhookEvent {
  const parsed = ClerkWebhookSchema.parse(raw);
  return parsed as ClerkWebhookEvent;
}

export async function POST(req: NextRequest) {
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    logger.warn("webhook.clerk.missing_svix_headers");
    return new Response("Missing svix headers", { status: 400 });
  }

  const secret = serverEnv.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    logger.error("webhook.clerk.secret_missing");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const payload = await req.text();

  let evt: ClerkWebhookEvent;
  try {
    const wh = new Webhook(secret);
    const verified = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
    evt = parseWebhookEvent(verified);
  } catch (err) {
    // Two distinct failure modes, one response. Either svix rejected
    // the signature (most likely) or our Zod parse rejected the shape
    // (extremely unlikely — would mean Clerk changed their envelope).
    // Both are non-actionable from the attacker's perspective so we
    // collapse the response and only branch in the log line.
    if (err instanceof z.ZodError) {
      logger.warn("webhook.clerk.payload_malformed");
    } else {
      logger.warn("webhook.clerk.signature_invalid");
    }
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  const eventType = evt.type;
  const userId = evt.data?.id;
  logger.info("webhook.clerk.received", { eventType, userId, svixId });

  // Replay protection: svix retries on 5xx (and on any timeout from
  // our side). Without dedupe, every retry re-runs the user sync —
  // mostly idempotent today, but a `user.deleted` retry would
  // un-undelete a user that an admin had since hard-restored, and any
  // future side-effects (welcome email, etc.) would fire twice.
  //
  // We claim the svix-id by inserting into processed_webhook_events;
  // PK conflict means another delivery beat us to it and we should
  // ack 200 without re-running the handler.
  try {
    await prisma.processedWebhookEvent.create({
      data: {
        provider: "clerk",
        eventId: svixId,
        eventType,
      },
    });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      logger.info("webhook.clerk.replay_ignored", { svixId, eventType, userId });
      return NextResponse.json({
        message: "Webhook already processed",
        eventType,
        userId,
        replayed: true,
      });
    }
    logger.error("webhook.clerk.dedupe_insert_failed", {
      svixId,
      error: err instanceof Error ? err.message : String(err),
    });
    return new Response("Error processing webhook", { status: 500 });
  }

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
    // If side-effects fail AFTER we claimed the event, undo the
    // dedupe entry so svix will retry. Without this, a transient DB
    // hiccup on user-sync would permanently swallow the event.
    await prisma.processedWebhookEvent
      .delete({
        where: { provider_eventId: { provider: "clerk", eventId: svixId } },
      })
      .catch(() => {
        // Best-effort cleanup. If the delete itself fails we'd rather
        // keep going and return 500 so svix retries — worst case the
        // retry hits a "replay" branch and is silently dropped.
      });
    logger.error("webhook.clerk.processing_error", {
      eventType,
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return new Response("Error processing webhook", { status: 500 });
  }
}
