import { NextRequest, NextResponse } from "next/server";
import { resolveDailyTarget } from "@/lib/game/daily-target";
import { parseUtcDate, todayUtcDateString } from "@/lib/game/similarity";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Resolve the effective daily target for today (or an explicit `?date=`).
 *
 * Public endpoint — the game page calls this to learn which Pokemon to
 * draw and whether shiny mode is forced. Admin overrides take precedence
 * over the deterministic hash.
 *
 * `date` is restricted to today or yesterday (UTC) to prevent the
 * endpoint from being scraped to learn future picks ahead of time.
 */
export async function GET(req: NextRequest) {
  try {
    const dateParam = req.nextUrl.searchParams.get("date");
    const todayStr = todayUtcDateString();
    const todayDate = parseUtcDate(todayStr);
    const yesterdayDate = new Date(todayDate.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = [
      yesterdayDate.getUTCFullYear(),
      String(yesterdayDate.getUTCMonth() + 1).padStart(2, "0"),
      String(yesterdayDate.getUTCDate()).padStart(2, "0"),
    ].join("-");

    let date: Date;
    if (!dateParam) {
      date = todayDate;
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        return NextResponse.json(
          { error: "Invalid date — expected YYYY-MM-DD" },
          { status: 400 },
        );
      }
      if (dateParam !== todayStr && dateParam !== yesterdayStr) {
        return NextResponse.json(
          {
            error:
              "Daily target is only resolvable for today or yesterday (UTC).",
          },
          { status: 400 },
        );
      }
      date = parseUtcDate(dateParam);
    }

    const target = await resolveDailyTarget(date);
    return NextResponse.json(
      {
        date: target.date,
        pokemonId: target.pokemonId,
        isShiny: target.isShiny,
        isOverride: target.isOverride,
      },
      {
        // The daily target is identical for every visitor on a given UTC day.
        // Shared CDN cache (s-maxage) lets Vercel serve thousands of requests
        // from a single function call per region. Admin overrides propagate
        // within 10 min; the browser also re-fetches on page mount.
        headers: {
          "Cache-Control":
            "public, s-maxage=600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (err) {
    logger.error("daily-target.route_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
