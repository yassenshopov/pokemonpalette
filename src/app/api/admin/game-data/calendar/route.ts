import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import { parseIsoDate, toIsoDate } from "@/lib/admin/range";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

type CalendarRow = {
  day: string;
  target_pokemon_id: number;
  attempts_count: number;
  wins: number;
  unique_players: number;
  avg_attempts: number;
};

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  try {
    const params = req.nextUrl.searchParams;
    let fromStr = params.get("from");
    let toStr = params.get("to");

    // Default to the current month if no range is provided.
    if (!fromStr || !toStr) {
      const now = new Date();
      const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
      fromStr = toIsoDate(first);
      toStr = toIsoDate(last);
    }

    const from = parseIsoDate(fromStr);
    const to = parseIsoDate(toStr);
    if (!from || !to) {
      return NextResponse.json(
        { error: "Invalid from/to — expected YYYY-MM-DD." },
        { status: 400 },
      );
    }
    if (to.getTime() < from.getTime()) {
      return NextResponse.json(
        { error: "`to` must be on or after `from`." },
        { status: 400 },
      );
    }
    // Guard against absurd ranges that would push the server unnecessarily.
    const span = Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;
    if (span > 400) {
      return NextResponse.json(
        { error: "Range too large; limit to 400 days or fewer." },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin.rpc("admin_game_calendar", {
      p_from: toIsoDate(from),
      p_to: toIsoDate(to),
    });

    if (error) {
      logger.error("admin.calendar.rpc_failed", { error: error.message });
      return NextResponse.json(
        { error: "Failed to load calendar." },
        { status: 500 },
      );
    }

    const rows = (data ?? []) as CalendarRow[];
    return NextResponse.json({
      from: toIsoDate(from),
      to: toIsoDate(to),
      days: rows,
    });
  } catch (err) {
    logger.error("admin.calendar.failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
