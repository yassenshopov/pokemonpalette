import { NextRequest, NextResponse } from "next/server";
import { Prisma, prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/auth";
import { recordAudit, type AdminAuditAction } from "@/lib/admin/audit";
import { logger } from "@/lib/logger";

type BulkOp = "ban" | "unban" | "delete" | "lock" | "unlock";

interface BulkBody {
  ids?: unknown;
  op?: unknown;
}

const MAX_IDS = 1000;

// POST - Run a bulk operation on a set of user IDs.
// Body: { ids: string[], op: 'ban' | 'unban' | 'delete' | 'lock' | 'unlock' }
export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  let body: BulkBody;
  try {
    body = (await req.json()) as BulkBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const op = body.op as BulkOp | undefined;
  if (!op || !["ban", "unban", "delete", "lock", "unlock"].includes(op)) {
    return NextResponse.json({ error: "Invalid op" }, { status: 400 });
  }

  const ids = Array.isArray(body.ids)
    ? (body.ids as unknown[]).filter(
        (v): v is string => typeof v === "string" && v.length > 0,
      )
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "No ids provided" }, { status: 400 });
  }

  if (ids.length > MAX_IDS) {
    return NextResponse.json(
      { error: `Too many ids (max ${MAX_IDS})` },
      { status: 400 },
    );
  }

  // Prevent self-harm: remove the caller's own id from any destructive op.
  const safeIds =
    op === "delete" || op === "ban" || op === "lock"
      ? ids.filter((id) => id !== gate.adminUserId)
      : ids;

  if (safeIds.length === 0) {
    return NextResponse.json(
      { error: "Refusing to act on yourself." },
      { status: 400 },
    );
  }

  // Last-admin guard. Bulk-banning, locking, or deleting users that
  // happen to include every active admin (or every active admin
  // except the caller) leaves the system with NO admins — at which
  // point the only way back is direct DB access. We refuse the
  // operation up front. The single-user PATCH already handles its
  // own "you can't demote yourself" guard; this is the bulk
  // equivalent for the demote-by-side-effect ops (lock, ban, delete
  // all lock the target out of admin powers).
  const isLockoutOp = op === "ban" || op === "lock" || op === "delete";
  if (isLockoutOp) {
    const remainingAdmins = await prisma.user.count({
      where: {
        isAdmin: true,
        isDeleted: false,
        banned: false,
        locked: false,
        id: { notIn: [...safeIds, gate.adminUserId] },
      },
    });
    if (remainingAdmins === 0) {
      return NextResponse.json(
        {
          error:
            "Refusing to lock out every active admin. Keep at least one usable admin account.",
        },
        { status: 400 },
      );
    }
  }

  const patch: Prisma.UserUpdateManyMutationInput = {};
  switch (op) {
    case "ban":
      patch.banned = true;
      break;
    case "unban":
      patch.banned = false;
      break;
    case "lock":
      patch.locked = true;
      break;
    case "unlock":
      patch.locked = false;
      break;
    case "delete":
      patch.isDeleted = true;
      break;
  }

  // Scope `delete` to non-deleted rows so the affected count matches
  // reality. Without this, re-running the same bulk delete returns
  // count=N for rows that were already soft-deleted, falsely
  // inflating the admin UI's "X rows affected" toast.
  const targetWhere: Prisma.UserWhereInput =
    op === "delete"
      ? { id: { in: safeIds }, isDeleted: false }
      : { id: { in: safeIds } };

  try {
    // Snapshot the affected rows BEFORE the update so the audit row's
    // `before_json` reflects the doomed state. We cap the snapshot at
    // the safe-id list (which is already bounded by `MAX_IDS`); for
    // very large bulk ops the snapshot still fits comfortably in the
    // 64 KB per-row truncation budget the audit helper enforces.
    const before = await prisma.user.findMany({
      where: targetWhere,
      select: {
        id: true,
        email: true,
        username: true,
        banned: true,
        locked: true,
        isAdmin: true,
        isDeleted: true,
      },
    });

    const { count } = await prisma.user.updateMany({
      where: targetWhere,
      data: patch,
    });

    const bulkActionMap: Record<BulkOp, AdminAuditAction> = {
      ban: "user.bulk_ban",
      unban: "user.bulk_unban",
      lock: "user.bulk_lock",
      unlock: "user.bulk_unlock",
      delete: "user.bulk_delete",
    };
    void recordAudit({
      actorUserId: gate.adminUserId,
      action: bulkActionMap[op],
      targetType: "user",
      targetId: `bulk:${count}`,
      before: { ids: safeIds, rows: before },
      after: { patch, affected: count },
    });

    return NextResponse.json({
      ok: true,
      affected: count,
      skipped: ids.length - safeIds.length,
    });
  } catch (err) {
    logger.error("admin.users.bulk_failed", {
      op,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Bulk operation failed" },
      { status: 500 },
    );
  }
}
