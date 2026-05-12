import { NextRequest, NextResponse } from "next/server";
import { Prisma, prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/auth";
import { pushAdminToClerk } from "@/lib/user-service";
import { logger } from "@/lib/logger";

// SECURITY: `private_metadata` and `unsafe_metadata` are intentionally
// stripped from the admin response — see the matching comment on the
// list endpoint at `src/app/api/admin/users/route.ts`. The TL;DR is
// Clerk treats `privateMetadata` as server-only state and
// `unsafeMetadata` is user-writable PII; neither belongs in every
// admin's browser. `publicMetadata` stays because the admin UI relies
// on it for the isAdmin flag.
//
// We accept the structurally-narrowed shape rather than
// `Prisma.UserGetPayload<object>` because the find calls below now
// use a `select` projection that omits those JSONB columns — passing
// the full payload type would be a lie. Listing the projected fields
// here also makes it impossible to silently re-introduce a leak by
// extending the select without updating the serializer.
type ProjectedAdminUser = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  imageUrl: string | null;
  profileImageUrl: string | null;
  hasImage: boolean;
  primaryEmailAddressId: string | null;
  primaryPhoneNumberId: string | null;
  banned: boolean;
  locked: boolean;
  backupCodeEnabled: boolean;
  twoFactorEnabled: boolean;
  totpEnabled: boolean;
  passwordEnabled: boolean;
  createOrganizationEnabled: boolean;
  deleteSelfEnabled: boolean;
  lastActiveAt: Date | null;
  lastSignInAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  isAdmin: boolean;
  receivesDailyEmails: boolean;
  paletteSize: number;
  emailAddresses: Prisma.JsonValue;
  phoneNumbers: Prisma.JsonValue;
  externalAccounts: Prisma.JsonValue;
  publicMetadata: Prisma.JsonValue;
};

function serializeUser(u: ProjectedAdminUser) {
  return {
    id: u.id,
    email: u.email,
    first_name: u.firstName,
    last_name: u.lastName,
    username: u.username,
    image_url: u.imageUrl,
    profile_image_url: u.profileImageUrl,
    has_image: u.hasImage,
    primary_email_address_id: u.primaryEmailAddressId,
    primary_phone_number_id: u.primaryPhoneNumberId,
    banned: u.banned,
    locked: u.locked,
    backup_code_enabled: u.backupCodeEnabled,
    two_factor_enabled: u.twoFactorEnabled,
    totp_enabled: u.totpEnabled,
    password_enabled: u.passwordEnabled,
    create_organization_enabled: u.createOrganizationEnabled,
    delete_self_enabled: u.deleteSelfEnabled,
    last_active_at: u.lastActiveAt?.toISOString() ?? null,
    last_sign_in_at: u.lastSignInAt?.toISOString() ?? null,
    created_at: u.createdAt.toISOString(),
    updated_at: u.updatedAt.toISOString(),
    is_deleted: u.isDeleted,
    is_admin: u.isAdmin,
    receives_daily_emails: u.receivesDailyEmails,
    palette_size: u.paletteSize,
    email_addresses: u.emailAddresses,
    phone_numbers: u.phoneNumbers,
    external_accounts: u.externalAccounts,
    public_metadata: u.publicMetadata,
  };
}

// GET - Get user + aggregate stats (detail view data).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { userId } = await params;

  try {
    // Same `select`-without-private-metadata projection as the list
    // endpoint. See the comment on `src/app/api/admin/users/route.ts`
    // for why `private_metadata` / `unsafe_metadata` never make it
    // out of Postgres.
    const [user, totalGames, totalWins, totalPalettes, recentAttempts] =
      await Promise.all([
        prisma.user.findFirst({
          where: { id: userId, isDeleted: false },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            username: true,
            imageUrl: true,
            profileImageUrl: true,
            hasImage: true,
            primaryEmailAddressId: true,
            primaryPhoneNumberId: true,
            banned: true,
            locked: true,
            backupCodeEnabled: true,
            twoFactorEnabled: true,
            totpEnabled: true,
            passwordEnabled: true,
            createOrganizationEnabled: true,
            deleteSelfEnabled: true,
            lastActiveAt: true,
            lastSignInAt: true,
            createdAt: true,
            updatedAt: true,
            isDeleted: true,
            isAdmin: true,
            receivesDailyEmails: true,
            paletteSize: true,
            emailAddresses: true,
            phoneNumbers: true,
            externalAccounts: true,
            publicMetadata: true,
          },
        }),
        prisma.dailyGameAttempt.count({ where: { userId } }),
        prisma.dailyGameAttempt.count({ where: { userId, won: true } }),
        prisma.savedPalette.count({ where: { userId } }),
        prisma.dailyGameAttempt.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 30,
          select: {
            id: true,
            date: true,
            won: true,
            attempts: true,
            hintsUsed: true,
            createdAt: true,
          },
        }),
      ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const losses = totalGames - totalWins;
    const winRate = totalGames > 0 ? (totalWins / totalGames) * 100 : 0;

    return NextResponse.json({
      user: serializeUser(user),
      stats: {
        totalGames,
        totalWins,
        totalLosses: losses,
        winRate: Math.round(winRate * 100) / 100,
        totalPalettes,
      },
      recentAttempts: recentAttempts.map((a) => ({
        id: a.id,
        date: a.date.toISOString().slice(0, 10),
        won: a.won,
        attempts: a.attempts,
        hints_used: a.hintsUsed,
        created_at: a.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    logger.error("admin.users.detail_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PATCH - Update mutable admin fields. Body: { banned?, locked?, is_admin? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { userId } = await params;

  let body: { banned?: unknown; locked?: unknown; is_admin?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (userId === gate.adminUserId && body.is_admin === false) {
    return NextResponse.json(
      { error: "Admins cannot demote themselves." },
      { status: 400 },
    );
  }

  const patch: Prisma.UserUpdateInput = {};
  if (typeof body.banned === "boolean") patch.banned = body.banned;
  if (typeof body.locked === "boolean") patch.locked = body.locked;
  if (typeof body.is_admin === "boolean") patch.isAdmin = body.is_admin;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update." },
      { status: 400 },
    );
  }

  try {
    // updateMany so we can filter by `is_deleted: false` in the same query;
    // `update()` only accepts a unique id.
    const { count } = await prisma.user.updateMany({
      where: { id: userId, isDeleted: false },
      data: patch,
    });
    if (count === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updated = await prisma.user.findUnique({ where: { id: userId } });
    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // If admin status changed, mirror it into Clerk publicMetadata so the
    // session JWT picks it up and requireAdmin() can skip the DB lookup on
    // subsequent requests. Fire-and-forget; failures are logged but don't
    // bubble — the DB is the source of truth.
    if (typeof body.is_admin === "boolean") {
      void pushAdminToClerk(userId, body.is_admin);
    }

    return NextResponse.json({ user: serializeUser(updated) });
  } catch (err) {
    logger.error("admin.users.patch_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 },
    );
  }
}

// DELETE - Soft-delete a user (is_deleted = true).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { userId } = await params;

  if (userId === gate.adminUserId) {
    return NextResponse.json(
      { error: "Admins cannot delete themselves." },
      { status: 400 },
    );
  }

  try {
    // Filter `isDeleted: false` so a DELETE on an already-soft-deleted
    // user surfaces as 404 instead of silently "succeeding" with
    // count=1. Pre-hardening the call returned `{ ok: true }` either
    // way, which lied to the audit log / admin UI: an admin who hit
    // delete twice saw success twice and assumed two distinct rows
    // were affected.
    const { count } = await prisma.user.updateMany({
      where: { id: userId, isDeleted: false },
      data: { isDeleted: true },
    });
    if (count === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("admin.users.delete_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 },
    );
  }
}
