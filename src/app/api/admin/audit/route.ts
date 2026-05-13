import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Pagination caps. The viewer page renders 25 rows by default; we
// allow up to 200 to accommodate "load more" without making it cheap
// to scrape the whole table from a single request.
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 200;

const ISO_DATE_OR_DATETIME = /^\d{4}-\d{2}-\d{2}(T.*)?$/;

const QuerySchema = z.object({
  // Filter by actor (admin who performed the action). Free-form Clerk
  // user id — we don't validate format because Clerk ids can change
  // shape over time.
  actor: z.string().trim().min(1).max(120).optional(),
  // Filter by action verb (e.g. "user.ban", "saved_palette.bulk_delete").
  action: z.string().trim().min(1).max(120).optional(),
  // Filter by target type (e.g. "user") and optionally target id.
  targetType: z.string().trim().min(1).max(60).optional(),
  targetId: z.string().trim().min(1).max(240).optional(),
  // ISO date or full ISO datetime; we use date-only for the UI but
  // accept datetimes so a future "audit row at exact moment" hash
  // link doesn't get clobbered by the regex.
  from: z.string().regex(ISO_DATE_OR_DATETIME).optional(),
  to: z.string().regex(ISO_DATE_OR_DATETIME).optional(),
  page: z.coerce.number().int().min(1).max(1_000_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
});

function parseDateBound(raw: string | undefined, end: boolean): Date | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  // If the caller passed a date-only value, expand the "to" bound to
  // the end of that UTC day so a filter like to=2026-05-13 includes
  // every row created on May 13 (not just the midnight tick).
  if (end && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    parsed.setUTCHours(23, 59, 59, 999);
  }
  return parsed;
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const parsed = QuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries()),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    actor,
    action,
    targetType,
    targetId,
    from,
    to,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  } = parsed.data;

  const where: Prisma.AdminAuditLogWhereInput = {};
  if (actor) where.actorUserId = actor;
  if (action) where.action = action;
  if (targetType) where.targetType = targetType;
  if (targetId) where.targetId = targetId;

  const fromDate = parseDateBound(from, false);
  const toDate = parseDateBound(to, true);
  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = fromDate;
    if (toDate) where.createdAt.lte = toDate;
  }

  try {
    const [rows, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          actorUserId: true,
          action: true,
          targetType: true,
          targetId: true,
          beforeJson: true,
          afterJson: true,
          createdAt: true,
        },
      }),
      prisma.adminAuditLog.count({ where }),
    ]);

    return NextResponse.json({
      rows: rows.map((r) => ({
        id: r.id,
        actor_user_id: r.actorUserId,
        action: r.action,
        target_type: r.targetType,
        target_id: r.targetId,
        before_json: r.beforeJson,
        after_json: r.afterJson,
        created_at: r.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    });
  } catch (err) {
    logger.error("admin.audit.list_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to load audit log" },
      { status: 500 },
    );
  }
}
