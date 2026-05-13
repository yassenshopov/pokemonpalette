import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/auth";
import { recordAudit } from "@/lib/admin/audit";
import { logger } from "@/lib/logger";

const MAX_IDS = 1000;

// POST - Bulk delete attempts. Body: { ids: string[] }.
export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  let body: { ids?: unknown };
  try {
    body = (await req.json()) as { ids?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
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

  try {
    // Snapshot before delete. We keep just enough to identify the
    // doomed rows (user, date, target, won state). The `guesses`
    // JSON column is intentionally NOT captured here — for a 1,000-id
    // bulk it would blow past the truncation budget without adding
    // any forensic value beyond what the per-row admin page already
    // shows.
    const before = await prisma.dailyGameAttempt.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        userId: true,
        date: true,
        targetPokemonId: true,
        attempts: true,
        won: true,
        hintsUsed: true,
        createdAt: true,
      },
    });

    const result = await prisma.dailyGameAttempt.deleteMany({
      where: { id: { in: ids } },
    });

    void recordAudit({
      actorUserId: gate.adminUserId,
      action: "game_data.bulk_delete",
      targetType: "daily_game_attempt",
      targetId: `bulk:${result.count}`,
      before: { ids, rows: before },
      after: { affected: result.count },
    });

    return NextResponse.json({ ok: true, affected: result.count });
  } catch (err) {
    logger.error("admin.game-data.bulk_delete_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Bulk delete failed" }, { status: 500 });
  }
}
