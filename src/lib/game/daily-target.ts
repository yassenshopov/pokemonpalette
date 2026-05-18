import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getDailyShinyStatus } from "@/lib/game/similarity";
import {
  getDailyPoolForDate,
  pickDailyPokemonId,
} from "@/lib/game/daily-pool";
import { logger } from "@/lib/logger";

export const DAILY_TARGET_TAG = "daily-target";

export interface DailyTarget {
  /** UTC date as YYYY-MM-DD. */
  date: string;
  pokemonId: number;
  isShiny: boolean;
  /** True if an admin override row supplied these values. */
  isOverride: boolean;
  /** Optional admin note attached to the override (null when algorithmic). */
  note: string | null;
  /** Short label for the active weekly pool ("Johto", "Hoenn", etc.). */
  poolTheme: string;
  /** Long label for the active weekly pool ("Johto week", "Original 151"). */
  poolLabel: string;
}

function toIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function algorithmicTarget(date: Date): DailyTarget {
  const isShiny = getDailyShinyStatus();
  const pool = getDailyPoolForDate(date);
  return {
    date: toIsoDate(date),
    pokemonId: pickDailyPokemonId(date, isShiny),
    isShiny,
    isOverride: false,
    note: null,
    poolTheme: pool.theme,
    poolLabel: pool.label,
  };
}

// Cached per-date resolver. The daily target only changes at UTC
// midnight (or when an admin writes an override), so for any given ISO
// date the result is stable across every request that day. Caching
// behind a tag lets the override mutation endpoint surgically
// invalidate after a save without having to re-fetch on every game
// request. Keyed on the ISO date — `unstable_cache` deep-equals its
// args, so passing the raw `Date` object would create one cache entry
// per microsecond.
const resolveDailyTargetCached = unstable_cache(
  async (isoDate: string): Promise<DailyTarget> => {
    const utcDate = new Date(`${isoDate}T00:00:00.000Z`);
    try {
      const row = await prisma.dailyOverride.findUnique({
        where: { date: utcDate },
        select: { pokemonId: true, isShiny: true, note: true },
      });
      if (row) {
        // Overrides keep the week's pool label so the player still sees
        // "Johto week" even when an admin pins a specific Pokémon — the
        // theme is a date property, not a target property.
        const pool = getDailyPoolForDate(utcDate);
        return {
          date: isoDate,
          pokemonId: row.pokemonId,
          isShiny: row.isShiny,
          isOverride: true,
          note: row.note,
          poolTheme: pool.theme,
          poolLabel: pool.label,
        };
      }
    } catch (err) {
      logger.error("daily-target.resolve_failed", {
        date: isoDate,
        error: err instanceof Error ? err.message : String(err),
      });
      // Fall through to algorithmic.
    }
    return algorithmicTarget(utcDate);
  },
  ["daily-target"],
  { revalidate: 3600, tags: [DAILY_TARGET_TAG] },
);

/**
 * Resolve the effective daily target for a single UTC date.
 *
 * Order of precedence:
 *  1. Admin override row in `daily_overrides` (if present)
 *  2. Deterministic hash from `getDailyPokemonIdForDate()`
 *
 * Failures fall back to the deterministic pick so the game keeps working
 * if the database hiccups — admin scheduling is a soft layer on top.
 */
export async function resolveDailyTarget(date: Date): Promise<DailyTarget> {
  const utcDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  return resolveDailyTargetCached(toIsoDate(utcDate));
}

/**
 * Batch resolver for the admin calendar — single query covering every
 * date in the requested range, then merge with deterministic defaults
 * for any day without an override.
 */
export async function resolveDailyTargets(
  dates: Date[],
): Promise<Map<string, DailyTarget>> {
  const result = new Map<string, DailyTarget>();
  if (dates.length === 0) return result;

  const utcDates = dates.map(
    (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())),
  );

  // Pre-fill defaults so unmatched days still resolve.
  for (const d of utcDates) {
    result.set(toIsoDate(d), algorithmicTarget(d));
  }

  try {
    const rows = await prisma.dailyOverride.findMany({
      where: { date: { in: utcDates } },
      select: { date: true, pokemonId: true, isShiny: true, note: true },
    });
    for (const row of rows) {
      const iso = toIsoDate(row.date);
      const pool = getDailyPoolForDate(row.date);
      result.set(iso, {
        date: iso,
        pokemonId: row.pokemonId,
        isShiny: row.isShiny,
        isOverride: true,
        note: row.note,
        poolTheme: pool.theme,
        poolLabel: pool.label,
      });
    }
  } catch (err) {
    logger.error("daily-target.batch_resolve_failed", {
      count: utcDates.length,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return result;
}
