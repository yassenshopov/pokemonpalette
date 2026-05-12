import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/auth";
import { parseUtcDate } from "@/lib/game/similarity";
import { DAILY_TARGET_TAG } from "@/lib/game/daily-target";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// GET — list overrides in a date range. Used by the calendar to render
// "override" badges, and by the daily puzzle sheet to detect whether the
// open day already has an override row.
// ---------------------------------------------------------------------------

const ListQuerySchema = z.object({
  from: z.string().regex(ISO_DATE, "Expected YYYY-MM-DD"),
  to: z.string().regex(ISO_DATE, "Expected YYYY-MM-DD"),
});

export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const parsed = ListQuerySchema.safeParse({
    from: req.nextUrl.searchParams.get("from") ?? "",
    to: req.nextUrl.searchParams.get("to") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const from = parseUtcDate(parsed.data.from);
  const to = parseUtcDate(parsed.data.to);
  if (to.getTime() < from.getTime()) {
    return NextResponse.json(
      { error: "`to` must be on or after `from`." },
      { status: 400 },
    );
  }
  // Same span guard as the calendar endpoint — keeps the response small
  // even if a curious caller asks for years of data.
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  if (days > 400) {
    return NextResponse.json(
      { error: "Range too large; limit to 400 days or fewer." },
      { status: 400 },
    );
  }

  try {
    const rows = await prisma.dailyOverride.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
      select: {
        date: true,
        pokemonId: true,
        isShiny: true,
        note: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      overrides: rows.map((r) => ({
        date: toIsoDate(r.date),
        pokemon_id: r.pokemonId,
        is_shiny: r.isShiny,
        note: r.note,
        created_by: r.createdBy,
        created_at: r.createdAt.toISOString(),
        updated_at: r.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    logger.error("admin.daily-overrides.list_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to load overrides" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PUT — create or update the override for a given date.
// ---------------------------------------------------------------------------

const PutBodySchema = z.object({
  date: z.string().regex(ISO_DATE, "Expected YYYY-MM-DD"),
  // Cap above any reasonable Pokedex size so the column constraint can
  // catch the rest. The actual Pokemon JSON files only go up to ~1,350.
  pokemonId: z.number().int().min(1).max(100_000),
  isShiny: z.boolean().optional().default(false),
  note: z
    .string()
    .max(280)
    .nullish()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
});

export async function PUT(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PutBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { date, pokemonId, isShiny, note } = parsed.data;
  const utcDate = parseUtcDate(date);

  try {
    const row = await prisma.dailyOverride.upsert({
      where: { date: utcDate },
      update: {
        pokemonId,
        isShiny,
        note,
        updatedAt: new Date(),
      },
      create: {
        date: utcDate,
        pokemonId,
        isShiny,
        note,
        createdBy: gate.adminUserId,
      },
    });

    // Invalidate the cached daily target for this date so the game
    // (and any other reader of `resolveDailyTarget`) picks up the new
    // override on the very next request instead of waiting for the
    // hourly revalidation window.
    revalidateTag(DAILY_TARGET_TAG);

    return NextResponse.json({
      override: {
        date: toIsoDate(row.date),
        pokemon_id: row.pokemonId,
        is_shiny: row.isShiny,
        note: row.note,
        created_by: row.createdBy,
        created_at: row.createdAt.toISOString(),
        updated_at: row.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    logger.error("admin.daily-overrides.upsert_failed", {
      date,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to save override" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — remove the override for a date, reverting to the algorithmic
// pick. Idempotent — deleting a missing date returns ok with affected=0.
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const dateParam = req.nextUrl.searchParams.get("date");
  if (!dateParam || !ISO_DATE.test(dateParam)) {
    return NextResponse.json(
      { error: "Missing or invalid `date` (expected YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  try {
    const result = await prisma.dailyOverride.deleteMany({
      where: { date: parseUtcDate(dateParam) },
    });
    if (result.count > 0) {
      revalidateTag(DAILY_TARGET_TAG);
    }
    return NextResponse.json({ ok: true, affected: result.count });
  } catch (err) {
    logger.error("admin.daily-overrides.delete_failed", {
      date: dateParam,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to remove override" },
      { status: 500 },
    );
  }
}
