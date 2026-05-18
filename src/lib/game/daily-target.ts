import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  getDailyHardShinyStatus,
  getDailyShinyStatus,
  normalizeDifficulty,
  type Difficulty,
} from "@/lib/game/similarity";
import {
  getDailyPoolForDate,
  pickDailyPokemonId,
} from "@/lib/game/daily-pool";
import { logger } from "@/lib/logger";

export const DAILY_TARGET_TAG = "daily-target";

export interface DailyTarget {
  /** UTC date as YYYY-MM-DD. */
  date: string;
  /** Which daily track this target belongs to. */
  difficulty: Difficulty;
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

/**
 * Algorithmic shiny pick per difficulty. Easy stays non-shiny (the
 * historical default — surface a normal Pokémon for the public daily
 * pool); hard rolls a deterministic per-date shiny so the harder track
 * uses the shiny variant on roughly half the days.
 */
function algorithmicShiny(date: Date, difficulty: Difficulty): boolean {
  if (difficulty === "hard") return getDailyHardShinyStatus(date);
  return getDailyShinyStatus();
}

function algorithmicTarget(date: Date, difficulty: Difficulty): DailyTarget {
  const isShiny = algorithmicShiny(date, difficulty);
  const pool = getDailyPoolForDate(date, difficulty);
  return {
    date: toIsoDate(date),
    difficulty,
    pokemonId: pickDailyPokemonId(date, isShiny, difficulty),
    isShiny,
    isOverride: false,
    note: null,
    poolTheme: pool.theme,
    poolLabel: pool.label,
  };
}

// Cached per-(date, difficulty) resolver. The daily target only changes
// at UTC midnight (or when an admin writes an override), so for any given
// ISO date + difficulty the result is stable across every request that
// day. Caching behind a tag lets the override mutation endpoint
// surgically invalidate after a save without having to re-fetch on every
// game request.
const resolveDailyTargetCached = unstable_cache(
  async (isoDate: string, difficulty: Difficulty): Promise<DailyTarget> => {
    const utcDate = new Date(`${isoDate}T00:00:00.000Z`);
    try {
      const row = await prisma.dailyOverride.findUnique({
        where: { date_difficulty: { date: utcDate, difficulty } },
        select: { pokemonId: true, isShiny: true, note: true },
      });
      if (row) {
        // Overrides keep the week's pool label so the player still sees
        // "Johto week" even when an admin pins a specific Pokémon — the
        // theme is a date property, not a target property.
        const pool = getDailyPoolForDate(utcDate, difficulty);
        return {
          date: isoDate,
          difficulty,
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
        difficulty,
        error: err instanceof Error ? err.message : String(err),
      });
      // Fall through to algorithmic.
    }
    return algorithmicTarget(utcDate, difficulty);
  },
  ["daily-target"],
  { revalidate: 3600, tags: [DAILY_TARGET_TAG] },
);

/**
 * Resolve the effective daily target for a single UTC date + difficulty.
 *
 * Order of precedence:
 *  1. Admin override row in `daily_overrides` keyed on (date, difficulty)
 *  2. Deterministic hash from `pickDailyPokemonId(date, shiny, difficulty)`
 *
 * Failures fall back to the deterministic pick so the game keeps working
 * if the database hiccups — admin scheduling is a soft layer on top.
 */
export async function resolveDailyTarget(
  date: Date,
  difficulty: Difficulty = "easy",
): Promise<DailyTarget> {
  const utcDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  return resolveDailyTargetCached(toIsoDate(utcDate), normalizeDifficulty(difficulty));
}

/**
 * Batch resolver for the admin calendar — single query covering every
 * date in the requested range, then merge with deterministic defaults
 * for any day without an override. Operates on one difficulty at a time;
 * callers wanting both tracks should issue two calls.
 */
export async function resolveDailyTargets(
  dates: Date[],
  difficulty: Difficulty = "easy",
): Promise<Map<string, DailyTarget>> {
  const result = new Map<string, DailyTarget>();
  if (dates.length === 0) return result;

  const normalized = normalizeDifficulty(difficulty);
  const utcDates = dates.map(
    (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())),
  );

  // Pre-fill defaults so unmatched days still resolve.
  for (const d of utcDates) {
    result.set(toIsoDate(d), algorithmicTarget(d, normalized));
  }

  try {
    const rows = await prisma.dailyOverride.findMany({
      where: { date: { in: utcDates }, difficulty: normalized },
      select: { date: true, pokemonId: true, isShiny: true, note: true },
    });
    for (const row of rows) {
      const iso = toIsoDate(row.date);
      const pool = getDailyPoolForDate(row.date, normalized);
      result.set(iso, {
        date: iso,
        difficulty: normalized,
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
      difficulty: normalized,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return result;
}
