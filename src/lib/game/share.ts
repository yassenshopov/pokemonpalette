import { FIRST_DAILY_GAME_DATE } from "@/constants/pokemon";

// These tunables control the Wordle-style share grid appearance.
// They are independent of the in-game similarity gradient so we can pick
// emoji tiers that communicate at-a-glance without being identical to the
// numeric display inside the app.
const SHARE_TIERS = [
  { min: 0.75, emoji: "🟩" },
  { min: 0.5, emoji: "🟨" },
  { min: 0.25, emoji: "🟧" },
  { min: 0, emoji: "🟥" },
] as const;

const EMPTY_CELL = "⬜";
const MAX_ATTEMPTS = 4;

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return null;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

function rgbDistance(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number }
): number {
  return Math.sqrt(
    (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2
  );
}

// Per-slot score mirrors calculateSimilarity() in src/lib/game/similarity.ts
// but for a single target color vs the guess palette. This keeps the share
// grid interpretable: each block shows how close the guess got to one of
// the target Pokemon's colors.
function scoreSlot(targetHex: string, guessHexes: string[]): number {
  const target = hexToRgb(targetHex);
  if (!target) return 0;
  let minDist = Infinity;
  for (const g of guessHexes) {
    const rgb = hexToRgb(g);
    if (!rgb) continue;
    const d = rgbDistance(target, rgb);
    if (d < minDist) minDist = d;
  }
  if (!Number.isFinite(minDist)) return 0;
  const normalized = Math.min(minDist / 250, 1);
  return Math.pow(1 - normalized, 1.5);
}

function bucketEmoji(score: number): string {
  for (const tier of SHARE_TIERS) {
    if (score >= tier.min) return tier.emoji;
  }
  return EMPTY_CELL;
}

export interface ShareGridGuess {
  colors: string[];
}

export interface BuildShareTextInput {
  gameNumber: number;
  attempts: number;
  won: boolean;
  hintsUsed?: number;
  targetColors: string[];
  guesses: ShareGridGuess[];
  url?: string;
}

/**
 * Build Wordle-style share text.
 *
 * Format:
 *   PokemonPalette #47 3/4
 *   🟥🟧🟨
 *   🟨🟧🟩
 *   🟩🟩🟩
 *
 *   pokemonpalette.com/game
 */
export function buildShareText(input: BuildShareTextInput): string {
  const {
    gameNumber,
    attempts,
    won,
    hintsUsed = 0,
    targetColors,
    guesses,
    url = "pokemonpalette.com/game",
  } = input;

  const header = `PokemonPalette #${gameNumber} ${won ? `${attempts}/${MAX_ATTEMPTS}` : `X/${MAX_ATTEMPTS}`}${
    hintsUsed > 0 ? ` (${hintsUsed}💡)` : ""
  }`;

  const targetTop = targetColors.slice(0, 3);
  const rows: string[] = [];
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const guess = guesses[i];
    if (!guess) {
      rows.push(EMPTY_CELL.repeat(targetTop.length || 3));
      continue;
    }
    const cells = targetTop.map((t) =>
      bucketEmoji(scoreSlot(t, guess.colors))
    );
    rows.push(cells.join(""));
  }

  return [header, ...rows, "", url].join("\n");
}

/**
 * Compute today's game number off the anchor date. Uses UTC so every client
 * sees the same number regardless of timezone (matches the next-puzzle
 * countdown which is also UTC).
 */
export function getDailyGameNumber(now: Date = new Date()): number {
  const anchor = FIRST_DAILY_GAME_DATE;
  const anchorUTC = Date.UTC(
    anchor.getUTCFullYear(),
    anchor.getUTCMonth(),
    anchor.getUTCDate()
  );
  const nowUTC = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const days = Math.floor((nowUTC - anchorUTC) / (1000 * 60 * 60 * 24));
  return days + 1;
}

/**
 * Best-effort copy to clipboard, with navigator.share as a mobile-first
 * alternative when available. Returns a discriminated result so callers can
 * surface the right toast.
 */
export async function shareOrCopy(text: string): Promise<"shared" | "copied" | "failed"> {
  if (typeof navigator === "undefined") return "failed";

  // On mobile Safari / Android Chrome, navigator.share opens the native
  // share sheet which is a much better UX than "copied to clipboard".
  if (
    typeof navigator.share === "function" &&
    // Only use share on touch devices; desktop Chrome also exposes it but
    // the UX is worse than a clipboard toast.
    /Mobi|Android|iPhone|iPad/.test(navigator.userAgent)
  ) {
    try {
      await navigator.share({ text });
      return "shared";
    } catch {
      // User cancelled or share failed - fall through to clipboard.
    }
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return "copied";
    } catch {
      return "failed";
    }
  }

  return "failed";
}
