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

// Derive the deterministic daily Pokemon id for a specific calendar date.
// `isShiny` is mixed into the seed so daily shiny mode can produce a
// different pick than daily normal mode on the same day.
//
// IMPORTANT: uses UTC date components so the server and every client see
// the same daily pick regardless of local timezone. Changing this would
// split the leaderboard across timezones.
export function getDailyPokemonIdForDate(
  date: Date,
  totalPokemon: number,
  isShiny: boolean,
): number {
  const dateStr = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}-${
    isShiny ? "shiny" : "normal"
  }`;
  return (hashString(dateStr) % totalPokemon) + 1;
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

// Derive the deterministic daily Pokemon id from today's date. `isShiny` is
// mixed into the seed so daily shiny mode can produce a different pick than
// daily normal mode on the same day.
export function getDailyPokemonId(totalPokemon: number, isShiny: boolean): number {
  return getDailyPokemonIdForDate(new Date(), totalPokemon, isShiny);
}

/** Pool of Pokemon used by daily mode. Matches the hard-coded call sites in
 *  `src/app/game/page.tsx` (Gen 1 only, for now). */
export const DAILY_POOL_SIZE = 151;

// Daily mode is non-shiny only for now.
export function getDailyShinyStatus(): boolean {
  return false;
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
