import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/auth";
import { recordAudit } from "@/lib/admin/audit";
import { logger } from "@/lib/logger";

const MAX_IDS = 1000;

// POST - Bulk delete palettes. Body: { ids: string[] }.
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
    // Snapshot before delete for the audit row. The user list is the
    // most useful field for reconstruction; we deliberately omit
    // `colors` and `imageUrl` here because (a) they can be re-derived
    // from `pokemonId` and (b) we want to keep the audit row well
    // under the 64 KB truncation budget even for a 1,000-id bulk.
    const before = await prisma.savedPalette.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        userId: true,
        pokemonId: true,
        pokemonName: true,
        pokemonForm: true,
        isShiny: true,
        paletteName: true,
        createdAt: true,
      },
    });

    const result = await prisma.savedPalette.deleteMany({
      where: { id: { in: ids } },
    });

    void recordAudit({
      actorUserId: gate.adminUserId,
      action: "saved_palette.bulk_delete",
      targetType: "saved_palette",
      targetId: `bulk:${result.count}`,
      before: { ids, rows: before },
      after: { affected: result.count },
    });

    return NextResponse.json({ ok: true, affected: result.count });
  } catch (err) {
    logger.error("admin.saved-palettes.bulk_delete_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Bulk delete failed" }, { status: 500 });
  }
}
