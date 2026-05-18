import type { ColorWithFrequency } from "@/lib/color-extractor";

// Simple 32-bit string hash used for the daily Pokemon seed.
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Today's UTC date as a YYYY-MM-DD string. Clients and the server use this
// so the `date` column in daily_game_attempts is consistent everywhere.
export function todayUtcDateString(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Parse a YYYY-MM-DD string into a UTC Date (midnight). Prefer this over
// `new Date("YYYY-MM-DD")` + `parseISO` because those can drift depending
// on the runtime's TZ handling.
export function parseUtcDate(dateStr: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) throw new Error(`Invalid date (expected YYYY-MM-DD): ${dateStr}`);
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo, d));
}

// Daily mode is non-shiny only for now.
export function getDailyShinyStatus(): boolean {
  return false;
}

// Difficulty tiers for daily mode. "easy" keeps the historical themed
// weekly pool; "hard" widens to the full Pokedex with a shiny chance so
// loyal players have a tougher daily target. See `daily-pool.ts` /
// `daily-target.ts` for how this flows through Pokemon selection, and
// migration 029 for the persistence/leaderboard split.
export type Difficulty = "easy" | "hard";

export const DIFFICULTIES = ["easy", "hard"] as const satisfies readonly Difficulty[];

export function isDifficulty(value: unknown): value is Difficulty {
  return value === "easy" || value === "hard";
}

/**
 * Normalize an arbitrary input to a valid `Difficulty`, falling back to
 * `"easy"` (the legacy / default mode) when the value is missing or
 * unrecognized. Used at API boundaries to keep callers that haven't
 * been updated yet on the original behavior.
 */
export function normalizeDifficulty(value: unknown): Difficulty {
  return isDifficulty(value) ? value : "easy";
}

/**
 * Hard mode rolls a shiny target deterministically per UTC date so every
 * player worldwide sees the same shiny status on the same day. We mix
 * the date string with a stable salt and split on parity — roughly 50%
 * of days end up shiny over a long window.
 */
export function getDailyHardShinyStatus(date: Date): boolean {
  const dateStr = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}-hard-shiny`;
  return hashString(dateStr) % 2 === 0;
}

function hexToRgb(hex: string) {
  const hexClean = hex.replace("#", "");
  return {
    r: parseInt(hexClean.substring(0, 2), 16),
    g: parseInt(hexClean.substring(2, 4), 16),
    b: parseInt(hexClean.substring(4, 6), 16),
  };
}

function colorDistance(c1: string, c2: string) {
  const a = hexToRgb(c1);
  const b = hexToRgb(c2);
  return Math.sqrt(
    Math.pow(a.r - b.r, 2) + Math.pow(a.g - b.g, 2) + Math.pow(a.b - b.b, 2)
  );
}

/**
 * Compute palette similarity: average of (1 - normalized minimum distance)
 * per color in `colors1`, with a steeper falloff curve so guesses have to
 * be visually close to score high.
 */
export function calculateSimilarity(
  colors1: string[] | ColorWithFrequency[],
  colors2: string[]
): number {
  if (colors1.length === 0 || colors2.length === 0) return 0;

  const effectiveMaxDistance = 250;
  let totalSimilarity = 0;

  colors1.forEach((color1) => {
    const color1Hex = typeof color1 === "string" ? color1 : color1.hex;
    let minDistance = Infinity;
    colors2.forEach((color2) => {
      const dist = colorDistance(color1Hex, color2);
      if (dist < minDistance) minDistance = dist;
    });
    const normalizedDistance = Math.min(minDistance / effectiveMaxDistance, 1);
    totalSimilarity += Math.pow(1 - normalizedDistance, 1.5);
  });

  return totalSimilarity / colors1.length;
}

export function getGuessToastMessage(attempts: number): string {
  switch (attempts) {
    case 1:
      return "Incredible! First try! 🎯";
    case 2:
      return "Excellent! Great job! 🌟";
    case 3:
      return "Nice work! Well done! 👍";
    case 4:
      return "Well done! You got it! 🎉";
    default:
      return "Congratulations! 🎊";
  }
}
