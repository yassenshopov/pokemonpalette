/**
 * Admin audit log writer.
 *
 * Every admin mutation should bookend its critical writes with a call
 * to `recordAudit()` so the action is attributable, reversible (in
 * principle, via the `before_json` snapshot), and shows up in the
 * `/admin/audit` viewer. The writer intentionally:
 *
 *   1. Never throws. A DB hiccup writing the audit row must not undo
 *      the underlying admin action — the action already succeeded by
 *      the time we get here, and a failure-to-audit is logged loudly
 *      so ops can backfill. Throwing here would couple the audit
 *      table's availability to every admin operation, which is the
 *      wrong trade-off.
 *
 *   2. Truncates `before` / `after` payloads at ~64 KB each so a
 *      pathological row (e.g. a huge `publicMetadata` blob) can't
 *      bloat the audit table. The truncated value is replaced with
 *      `{ __truncated: true, original_size: N }` so the viewer can
 *      indicate truncation without lying about the payload.
 *
 *   3. Strips Clerk's `private_metadata` / `unsafe_metadata` from any
 *      user snapshot before persisting — these are server-only state
 *      and don't belong in an audit row that every admin can read.
 */

import { Prisma, prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Common admin actions. The DB column is plain TEXT so callers can
 * pass anything, but the union here keeps usage consistent across
 * routes and gives the viewer page a stable enum to render filters
 * against.
 */
export type AdminAuditAction =
  | "user.update"
  | "user.ban"
  | "user.unban"
  | "user.lock"
  | "user.unlock"
  | "user.promote"
  | "user.demote"
  | "user.delete"
  | "user.bulk_ban"
  | "user.bulk_unban"
  | "user.bulk_lock"
  | "user.bulk_unlock"
  | "user.bulk_delete"
  | "saved_palette.delete"
  | "saved_palette.bulk_delete"
  | "game_data.delete"
  | "game_data.bulk_delete"
  | "pokemon_colors.update"
  | "daily_override.upsert"
  | "daily_override.delete";

export type AdminAuditTargetType =
  | "user"
  | "saved_palette"
  | "daily_game_attempt"
  | "pokemon_colors"
  | "daily_override";

export interface RecordAuditInput {
  actorUserId: string;
  action: AdminAuditAction | (string & {});
  targetType: AdminAuditTargetType | (string & {});
  targetId: string;
  /** Pre-change snapshot. Pass `null` for create-only actions. */
  before?: unknown;
  /** Post-change snapshot. Pass `null` for delete actions. */
  after?: unknown;
}

const MAX_JSON_BYTES = 64 * 1024;

const SENSITIVE_USER_FIELDS = new Set([
  "privateMetadata",
  "private_metadata",
  "unsafeMetadata",
  "unsafe_metadata",
]);

function scrubSensitive<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => scrubSensitive(item)) as unknown as T;
  }
  if (typeof value === "object") {
    const scrubbed: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_USER_FIELDS.has(key)) continue;
      scrubbed[key] = scrubSensitive(v);
    }
    return scrubbed as unknown as T;
  }
  return value;
}

function truncate(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  const scrubbed = scrubSensitive(value);
  const serialized = JSON.stringify(scrubbed);
  if (serialized.length <= MAX_JSON_BYTES) return scrubbed;
  return {
    __truncated: true,
    original_size: serialized.length,
  };
}

/**
 * Persist one audit row. Returns `true` on success, `false` on any
 * caught error — the caller can decide whether to surface the failure
 * (in practice nobody does, since the underlying admin action is
 * already committed).
 */
// Prisma represents nullable JSONB fields with a discriminated sentinel
// (`Prisma.JsonNull`) when you want SQL NULL, vs `Prisma.DbNull` when
// you want the JSON null literal. We always want SQL NULL for absent
// before/after snapshots — the column is queryable with `IS NULL`,
// matches the migration's nullable column, and serializes cleanly.
function jsonOrNull(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) return Prisma.JsonNull;
  const truncated = truncate(value);
  if (truncated === null) return Prisma.JsonNull;
  return truncated as Prisma.InputJsonValue;
}

export async function recordAudit(input: RecordAuditInput): Promise<boolean> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        beforeJson: jsonOrNull(input.before),
        afterJson: jsonOrNull(input.after),
      },
    });
    return true;
  } catch (err) {
    logger.error("admin_audit.write_failed", {
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
