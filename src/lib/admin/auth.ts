import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export type AdminAuthSuccess = { ok: true; adminUserId: string };
export type AdminAuthFailure = { ok: false; response: NextResponse };

/**
 * Verifies the caller is signed in AND has admin rights.
 *
 * The Clerk session claim (`metadata.isAdmin` / `publicMetadata.isAdmin`)
 * is used as a CHEAP REJECT for non-admins (a missing/false claim means
 * we can 403 without touching the DB at all). For positive admin checks
 * we always confirm against the live `users` row so a banned, locked,
 * or soft-deleted admin loses access immediately — the JWT can live for
 * days and is not authoritative for revocation.
 *
 * Trade-off: every admin request now costs one cheap indexed lookup.
 * That is acceptable; the previous "trust the JWT" fast path was the
 * source of the banned-admin escalation bug (audit P0-5).
 */
export async function requireAdmin(): Promise<AdminAuthSuccess | AdminAuthFailure> {
  let adminUserId: string | null = null;
  let sessionIsAdmin: boolean | null = null;
  try {
    const authResult = await auth();
    adminUserId = authResult.userId;

    // Read from either location the Clerk JWT template might stamp. We
    // intentionally coerce to `boolean` so a stray string ("false") doesn't
    // grant access.
    const claims = authResult.sessionClaims as
      | {
          metadata?: { isAdmin?: unknown };
          publicMetadata?: { isAdmin?: unknown };
        }
      | null
      | undefined;
    const raw =
      claims?.metadata?.isAdmin ?? claims?.publicMetadata?.isAdmin ?? null;
    if (typeof raw === "boolean") {
      sessionIsAdmin = raw;
    }
  } catch (err) {
    logger.error("auth.service_unavailable", {
      route: "requireAdmin",
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authentication service unavailable" },
        { status: 503 },
      ),
    };
  }

  if (!adminUserId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  // Fast reject: a "not admin" session claim is authoritative — once
  // an admin is demoted we re-mint the JWT, and a non-admin caller
  // never carries the claim at all.
  if (sessionIsAdmin === false) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 },
      ),
    };
  }

  // SECURITY (regression fix):
  //
  // The previous fast path bypassed the DB entirely when the JWT
  // carried `publicMetadata.isAdmin: true`. That created two bugs:
  //   1. An admin banned via the Clerk dashboard kept full admin
  //      powers until their session expired — `banned` isn't mirrored
  //      into the claim and the JWT can live for days.
  //   2. A row soft-deleted in our DB (`isDeleted: true`) but still
  //      logged in to Clerk also kept admin powers.
  //
  // We now always require a current `users` row that is non-deleted,
  // non-banned, non-locked, and `is_admin: true`. The session claim
  // gates whether we ever look up the row (skipping the DB for the
  // overwhelmingly common non-admin case), but the admin row itself
  // is the source of truth.
  const currentUser = await prisma.user.findFirst({
    where: {
      id: adminUserId,
      isDeleted: false,
      banned: false,
      locked: false,
    },
    select: { isAdmin: true },
  });

  if (!currentUser || !currentUser.isAdmin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 },
      ),
    };
  }

  return { ok: true, adminUserId };
}
