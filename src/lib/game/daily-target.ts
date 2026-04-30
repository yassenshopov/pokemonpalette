import { prisma } from "@/lib/prisma";
import {
  DAILY_POOL_SIZE,
  getDailyPokemonIdForDate,
  getDailyShinyStatus,
} from "@/lib/game/similarity";
import { logger } from "@/lib/logger";

export interface DailyTarget {
  /** UTC date as YYYY-MM-DD. */
  date: string;
  pokemonId: number;
  isShiny: boolean;
  /** True if an admin override row supplied these values. */
  isOverride: boolean;
  /** Optional admin note attached to the override (null when algorithmic). */
  note: string | null;
}

function toIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function algorithmicTarget(date: Date): DailyTarget {
  const isShiny = getDailyShinyStatus();
  return {
    date: toIsoDate(date),
    pokemonId: getDailyPokemonIdForDate(date, DAILY_POOL_SIZE, isShiny),
    isShiny,
    isOverride: false,
    note: null,
  };
}

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
  try {
    const row = await prisma.dailyOverride.findUnique({
      where: { date: utcDate },
      select: { pokemonId: true, isShiny: true, note: true },
    });
    if (row) {
      return {
        date: toIsoDate(utcDate),
        pokemonId: row.pokemonId,
        isShiny: row.isShiny,
        isOverride: true,
        note: row.note,
      };
    }
  } catch (err) {
    logger.error("daily-target.resolve_failed", {
      date: toIsoDate(utcDate),
      error: err instanceof Error ? err.message : String(err),
    });
    // Fall through to algorithmic.
  }
  return algorithmicTarget(utcDate);
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
      result.set(iso, {
        date: iso,
        pokemonId: row.pokemonId,
        isShiny: row.isShiny,
        isOverride: true,
        note: row.note,
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
