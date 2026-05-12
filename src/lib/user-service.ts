import type { User } from "@prisma/client";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Canonical Clerk → database sync layer.
 *
 * Everything that touches the `users` table in response to a Clerk event
 * goes through this file. The webhook handler, server actions, and any
 * backfill scripts all call these functions — the goal is to have exactly
 * one place where the Clerk payload shape is mapped to our schema.
 *
 * Prior to this refactor, `src/app/api/webhooks/clerk/route.ts` did its
 * own `supabaseAdmin.upsert(...)` and omitted a bunch of fields (e.g. it
 * always took email_addresses[0] instead of matching
 * `primary_email_address_id`). Those inconsistencies are fixed here.
 */

export type ClerkEmailAddress = {
  id: string;
  email_address: string;
};

export type ClerkUserPayload = {
  id: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string;
  profile_image_url?: string;
  has_image?: boolean;
  primary_email_address_id?: string | null;
  primary_phone_number_id?: string | null;
  banned?: boolean;
  locked?: boolean;
  backup_code_enabled?: boolean;
  two_factor_enabled?: boolean;
  totp_enabled?: boolean;
  password_enabled?: boolean;
  create_organization_enabled?: boolean;
  delete_self_enabled?: boolean;
  last_active_at?: number | null;
  last_sign_in_at?: number | null;
  created_at?: number;
  updated_at?: number;
  email_addresses?: ClerkEmailAddress[];
  phone_numbers?: unknown[];
  external_accounts?: unknown[];
  public_metadata?: Record<string, unknown>;
  private_metadata?: Record<string, unknown>;
  unsafe_metadata?: Record<string, unknown>;
};

/** Resolve the primary email by matching `primary_email_address_id` — the
 *  previous implementation always picked index 0, which silently picked the
 *  wrong email when a user rearranged their addresses. */
export function resolvePrimaryEmail(
  payload: Pick<ClerkUserPayload, "email_addresses" | "primary_email_address_id">
): string | null {
  const list = payload.email_addresses ?? [];
  if (list.length === 0) return null;
  const byPrimary = payload.primary_email_address_id
    ? list.find((e) => e.id === payload.primary_email_address_id)
    : null;
  return (byPrimary ?? list[0])?.email_address ?? null;
}

function toDate(unix: number | null | undefined): Date | null {
  if (unix == null) return null;
  return new Date(unix);
}

/**
 * Upsert a user from a Clerk payload. Idempotent — safe to call on the
 * same payload repeatedly.
 */
export async function syncUserFromClerk(payload: ClerkUserPayload): Promise<User> {
  const primaryEmail = resolvePrimaryEmail(payload);

  const base = {
    email: primaryEmail,
    firstName: payload.first_name ?? null,
    lastName: payload.last_name ?? null,
    username: payload.username ?? null,
    imageUrl: payload.image_url ?? null,
    profileImageUrl: payload.profile_image_url ?? null,
    hasImage: payload.has_image ?? false,
    primaryEmailAddressId: payload.primary_email_address_id ?? null,
    primaryPhoneNumberId: payload.primary_phone_number_id ?? null,
    banned: payload.banned ?? false,
    locked: payload.locked ?? false,
    backupCodeEnabled: payload.backup_code_enabled ?? false,
    twoFactorEnabled: payload.two_factor_enabled ?? false,
    totpEnabled: payload.totp_enabled ?? false,
    passwordEnabled: payload.password_enabled ?? false,
    createOrganizationEnabled: payload.create_organization_enabled ?? true,
    deleteSelfEnabled: payload.delete_self_enabled ?? true,
    lastActiveAt: toDate(payload.last_active_at),
    lastSignInAt: toDate(payload.last_sign_in_at),
    emailAddresses: (payload.email_addresses ?? []) as unknown as object,
    phoneNumbers: (payload.phone_numbers ?? []) as unknown as object,
    externalAccounts: (payload.external_accounts ?? []) as unknown as object,
    publicMetadata: (payload.public_metadata ?? {}) as unknown as object,
    privateMetadata: (payload.private_metadata ?? {}) as unknown as object,
    unsafeMetadata: (payload.unsafe_metadata ?? {}) as unknown as object,
    isDeleted: false,
  };

  const createdAt = toDate(payload.created_at) ?? new Date();
  const updatedAt = toDate(payload.updated_at) ?? new Date();

  // Geo fields (`country_code`, `timezone`, `geo_updated_at`) are populated
  // by `POST /api/me/geo` from request headers, not by Clerk. We must
  // therefore omit them from the update path so a webhook event doesn't
  // overwrite them with NULL. They're also intentionally absent from the
  // `create` path so a brand-new row starts NULL and is filled in on the
  // user's first authenticated request.
  const user = await prisma.user.upsert({
    where: { id: payload.id },
    update: {
      ...base,
      updatedAt,
    },
    create: {
      id: payload.id,
      ...base,
      createdAt,
      updatedAt,
    },
  });

  logger.info("user.synced", { userId: user.id });
  return user;
}

/** Soft-delete a user. Hard deletes cascade to saved_palettes /
 *  daily_game_attempts, which we don't want.
 *
 *  We use `updateMany` instead of `update` so that calling this for a
 *  user that doesn't exist (e.g. a Clerk webhook firing `user.deleted`
 *  for an account our DB never saw) is a no-op rather than throwing
 *  Prisma's P2025. The previous version bubbled P2025 up through the
 *  webhook handler, which then 500'd Clerk and triggered a retry
 *  storm. Returning `null` for "no row affected" lets the caller log
 *  and ack cleanly. */
export async function softDeleteUser(userId: string): Promise<User | null> {
  const result = await prisma.user.updateMany({
    where: { id: userId, isDeleted: false },
    data: { isDeleted: true, updatedAt: new Date() },
  });
  if (result.count === 0) {
    logger.info("user.soft_delete_noop", { userId });
    return null;
  }
  logger.info("user.soft_deleted", { userId });
  // Re-read so callers still get the full row for downstream logging.
  // The webhook handler doesn't actually use the return value, so this
  // is a small surface change rather than a breaking one.
  return prisma.user.findUnique({ where: { id: userId } });
}

/** Fetch a non-deleted user by id. */
export async function getUserById(userId: string): Promise<User | null> {
  return prisma.user.findFirst({
    where: { id: userId, isDeleted: false },
  });
}

/** Fetch a non-deleted user by email. */
export async function getUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findFirst({
    where: { email, isDeleted: false },
  });
}

/** Existence check used by middleware / admin. */
export async function userExists(userId: string): Promise<boolean> {
  const u = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false },
    select: { id: true },
  });
  return u !== null;
}

/**
 * Mirror the admin flag into Clerk `publicMetadata.isAdmin` so it flows into
 * the session JWT. The JWT is what `requireAdmin()` reads on the hot path,
 * avoiding a DB hit per admin request (see H12 in the audit plan).
 *
 * Safe to call redundantly. Logs and swallows Clerk errors — the DB remains
 * the source of truth, so a failed metadata push just delays the optimization
 * for that user until the next sync.
 */
export async function pushAdminToClerk(
  userId: string,
  isAdmin: boolean,
): Promise<void> {
  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { isAdmin },
    });
    logger.info("user.admin_claim_synced", { userId });
  } catch (err) {
    logger.error("user.admin_claim_sync_failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
