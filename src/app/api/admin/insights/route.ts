import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import {
  rangeFromSearchParams,
  resolveRange,
  type RangeValue,
} from "@/lib/admin/range";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

interface SparkPoint {
  date: string;
  count: number;
}

interface PokedexRow {
  pokemon_id: number;
  pokemon_name: string | null;
  attempts: number;
  wins: number;
  palettes: number;
  score: number;
}

interface RpcPayload {
  kpis: Record<string, number>;
  totals: Record<string, number>;
  series: {
    rangeAttempts: SparkPoint[];
    rangePalettes: SparkPoint[];
    allAttempts: SparkPoint[];
    allPalettes: SparkPoint[];
  };
  heatmap: {
    attempts: SparkPoint[];
    palettes: SparkPoint[];
  };
  pokedex: PokedexRow[];
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  try {
    const range: RangeValue = rangeFromSearchParams(req.nextUrl.searchParams);
    const resolved = resolveRange(range);

    const { data, error } = await supabaseAdmin.rpc("admin_insights_stats", {
      p_from: resolved.fromISO,
      p_to: resolved.toISO,
      p_prev_from: resolved.prevFromISO,
      p_prev_to: resolved.prevToISO,
    });

    if (error) {
      logger.error("admin.insights.rpc_failed", { error: error.message });
      return NextResponse.json(
        { error: "Failed to aggregate insights." },
        { status: 500 },
      );
    }

    const payload = (data ?? {}) as RpcPayload;

    return NextResponse.json({
      range: {
        preset: range.preset,
        from: resolved.from,
        to: resolved.to,
        days: resolved.days,
        label: resolved.label,
      },
      kpis: payload.kpis,
      totals: payload.totals,
      series: payload.series,
      heatmap: payload.heatmap,
      pokedex: payload.pokedex ?? [],
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("admin.insights.failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
