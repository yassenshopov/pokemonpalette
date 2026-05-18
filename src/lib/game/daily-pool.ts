/**
 * Weekly themed pools for daily mode.
 *
 * The previous daily mode was hard-coded to Gen 1 only — a pool of 151
 * Pokémon that engaged players have already cycled through several times
 * over. This module rotates the pool weekly (UTC Mondays) through every
 * generation, giving the daily challenge a content lifespan of ~1,025
 * Pokémon at the same daily cadence.
 *
 * Determinism contract: for any UTC date, this module returns the same
 * pool every time. The hash that picks a specific Pokémon within the
 * pool also continues to be date-seeded (see `pickDailyPokemonId`), so
 * every player worldwide sees the same daily target.
 *
 * Backward compat: dates before `ROTATION_START_DATE` keep returning the
 * original Gen-1 pool so the historical daily_game_attempts leaderboard
 * and streak records stay consistent.
 */

import { hashString, type Difficulty } from "./similarity";

export interface DailyPool {
  /** Pokémon IDs in this pool (1-1025 from the National Pokédex). */
  ids: number[];
  /** Short label for UI badges and emails. "Johto", "Hoenn", … */
  theme: string;
  /** Long label for the meta tagline. "Johto week", "Original 151". */
  label: string;
}

/**
 * Date the weekly rotation goes live. Set to the next UTC Monday after
 * the rotation feature ships so existing leaderboards through the prior
 * week remain on the original Gen-1 pool.
 *
 * NOTE: month is 0-indexed in `Date.UTC` — `4` is May.
 */
export const ROTATION_START_DATE = new Date(Date.UTC(2026, 4, 25));

/**
 * Pokédex ID ranges by generation. Inclusive on both ends. Sources from
 * the National Pokédex through Gen 9.
 */
const GEN_RANGES = {
  kanto: [1, 151],
  johto: [152, 251],
  hoenn: [252, 386],
  sinnoh: [387, 493],
  unova: [494, 649],
  kalos: [650, 721],
  alola: [722, 809],
  galar: [810, 905],
  paldea: [906, 1025],
} as const;

function rangeIds(range: readonly [number, number]): number[] {
  const [start, end] = range;
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

/**
 * 9-week themed rotation. Ordered so the first cycled week is **Johto**,
 * not Kanto — the platform spent its first six months on Gen 1 only, and
 * the loyal-player experience peaks on something fresh. Kanto returns
 * in week 9, then the cycle repeats — so every loyal player sees each
 * region roughly every 2 months.
 */
const POOLS: DailyPool[] = [
  { theme: "Johto", label: "Johto week", ids: rangeIds(GEN_RANGES.johto) },
  { theme: "Hoenn", label: "Hoenn week", ids: rangeIds(GEN_RANGES.hoenn) },
  { theme: "Sinnoh", label: "Sinnoh week", ids: rangeIds(GEN_RANGES.sinnoh) },
  { theme: "Unova", label: "Unova week", ids: rangeIds(GEN_RANGES.unova) },
  { theme: "Kalos", label: "Kalos week", ids: rangeIds(GEN_RANGES.kalos) },
  { theme: "Alola", label: "Alola week", ids: rangeIds(GEN_RANGES.alola) },
  { theme: "Galar", label: "Galar week", ids: rangeIds(GEN_RANGES.galar) },
  { theme: "Paldea", label: "Paldea week", ids: rangeIds(GEN_RANGES.paldea) },
  { theme: "Kanto", label: "Kanto week", ids: rangeIds(GEN_RANGES.kanto) },
];

const PRE_ROTATION_POOL: DailyPool = {
  theme: "Kanto",
  label: "Original 151",
  ids: rangeIds(GEN_RANGES.kanto),
};

/**
 * Hard mode's pool: the entire National Pokédex (1-1025) every day.
 * No weekly rotation — loyal players opting into hard get full breadth
 * by design, since the easy track already gives them themed week
 * variety.
 */
const HARD_POOL: DailyPool = {
  theme: "All regions",
  label: "Full Pokédex",
  ids: (() => {
    const ranges = Object.values(GEN_RANGES);
    const out: number[] = [];
    for (const range of ranges) {
      for (const id of rangeIds(range)) out.push(id);
    }
    return out;
  })(),
};

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Resolve the daily pool for a given UTC date.
 *
 * Easy mode (default): pre-rotation dates return the original Gen-1
 * pool, post-rotation dates index into POOLS by weeks-since-rotation-start.
 *
 * Hard mode: always returns the full 1-1025 pool. The weekly themed
 * rotation is intentionally an easy-only feature so the hard track
 * stays maximally varied.
 */
export function getDailyPoolForDate(
  date: Date,
  difficulty: Difficulty = "easy",
): DailyPool {
  if (difficulty === "hard") return HARD_POOL;
  if (date.getTime() < ROTATION_START_DATE.getTime()) {
    return PRE_ROTATION_POOL;
  }
  const weeksSinceStart = Math.floor(
    (date.getTime() - ROTATION_START_DATE.getTime()) / MS_PER_WEEK,
  );
  // Modulo with the +length+%length dance handles the theoretically-
  // impossible negative case so we never crash on weird system clocks.
  const index =
    ((weeksSinceStart % POOLS.length) + POOLS.length) % POOLS.length;
  return POOLS[index] ?? PRE_ROTATION_POOL;
}

/**
 * Pick the daily Pokémon ID for a date using the pool that's active for
 * that date's week + difficulty.
 *
 * The seed mixes the date, the shiny flag, and the difficulty so:
 *   - easy + normal, easy + shiny, hard + normal, hard + shiny all
 *     resolve to independent picks on the same day.
 *   - Every player worldwide sees the same target for a given
 *     (date, difficulty, shiny) triple.
 */
export function pickDailyPokemonId(
  date: Date,
  isShiny: boolean,
  difficulty: Difficulty = "easy",
): number {
  const pool = getDailyPoolForDate(date, difficulty);
  const dateStr = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}-${difficulty}-${
    isShiny ? "shiny" : "normal"
  }`;
  const index = hashString(dateStr) % pool.ids.length;
  return pool.ids[index] ?? pool.ids[0] ?? 1;
}
