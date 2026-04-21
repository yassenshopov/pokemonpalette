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
export function getDailyPokemonIdForDate(
  date: Date,
  totalPokemon: number,
  isShiny: boolean,
): number {
  const dateStr = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${
    isShiny ? "shiny" : "normal"
  }`;
  return (hashString(dateStr) % totalPokemon) + 1;
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
