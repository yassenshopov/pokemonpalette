import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export type AdminAuthSuccess = { ok: true; adminUserId: string };
export type AdminAuthFailure = { ok: false; response: NextResponse };

/**
 * Verifies the caller is signed in and has admin rights. The admin flag is
 * read from the Clerk session claim (`metadata.isAdmin` or
 * `publicMetadata.isAdmin`) when present, so the common-case admin request
 * is pure JWT — zero database round-trips.
 *
 * This requires the Clerk JWT template to forward `publicMetadata` into the
 * session. If the claim is missing (e.g. unmigrated session, template not
 * yet configured) we fall back to the users table, which keeps the old
 * behaviour working during rollout. Use `syncUserFromClerk` to keep
 * `publicMetadata.isAdmin` in lockstep with `users.is_admin`.
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

  // Fast path: trust the Clerk session claim. This is the common case once
  // `syncUserFromClerk` has run for every admin. Zero DB hit.
  if (sessionIsAdmin === true) {
    return { ok: true, adminUserId };
  }
  if (sessionIsAdmin === false) {
    // Claim says "not admin" — reject without touching the DB.
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 },
      ),
    };
  }

  // Fallback: claim is absent. Hit the DB once, then continue.
  const currentUser = await prisma.user.findFirst({
    where: { id: adminUserId, isDeleted: false },
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
