import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/auth";
import {
  rangeFromSearchParams,
  resolveRange,
  type RangeValue,
} from "@/lib/admin/range";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

interface GeoRow {
  country_code: string;
  users: number;
  active_in_range: number;
  attempts_in_range: number;
  palettes_in_range: number;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  try {
    const range: RangeValue = rangeFromSearchParams(req.nextUrl.searchParams);
    const resolved = resolveRange(range);

    const [{ data, error }, locatedUsers, totalUsers] = await Promise.all([
      supabaseAdmin.rpc("admin_user_geography", {
        p_from: resolved.fromISO,
        p_to: resolved.toISO,
      }),
      // Total users with a country code populated — drives the "geo
      // coverage" indicator on the map card.
      prisma.user.count({
        where: { isDeleted: false, countryCode: { not: null } },
      }),
      prisma.user.count({ where: { isDeleted: false } }),
    ]);

    if (error) {
      logger.error("admin.insights.geography.rpc_failed", {
        error: error.message,
      });
      return NextResponse.json(
        { error: "Failed to aggregate user geography." },
        { status: 500 },
      );
    }

    const rows = ((data ?? []) as GeoRow[]).map((row) => ({
      country_code: row.country_code,
      users: Number(row.users),
      active_in_range: Number(row.active_in_range),
      attempts_in_range: Number(row.attempts_in_range),
      palettes_in_range: Number(row.palettes_in_range),
    }));

    return NextResponse.json({
      range: {
        preset: range.preset,
        from: resolved.from,
        to: resolved.to,
        days: resolved.days,
        label: resolved.label,
      },
      coverage: {
        located: locatedUsers,
        total: totalUsers,
      },
      rows,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("admin.insights.geography.failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
