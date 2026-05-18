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
  /**
   * Daily-puzzle game number. Omit for Unlimited mode — the header then
   * reads "PokemonPalette · Unlimited" with no daily number.
   */
  gameNumber?: number;
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
 * Daily format:
 *   PokemonPalette #47 3/4
 *   🟥🟧🟨
 *   🟨🟧🟩
 *   🟩🟩🟩
 *
 *   pokemonpalette.com/game
 *
 * Unlimited format (when gameNumber is omitted):
 *   PokemonPalette · Unlimited 2/4
 *   🟧🟨🟨
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

  // Daily wins get "#47", unlimited wins get "· Unlimited" — both stay
  // visually anchored to "PokemonPalette" so the brand sits at the start of
  // every shared post.
  const label = gameNumber !== undefined ? `#${gameNumber}` : "· Unlimited";
  const score = won ? `${attempts}/${MAX_ATTEMPTS}` : `X/${MAX_ATTEMPTS}`;
  const hints = hintsUsed > 0 ? ` (${hintsUsed}💡)` : "";
  const header = `PokemonPalette ${label} ${score}${hints}`;

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
 * Where to send the share. "native" uses navigator.share (best on mobile),
 * "copy" puts the text on the clipboard, the rest open the platform's
 * compose intent in a new tab with the text prefilled.
 */
export type ShareTarget = "native" | "copy" | "twitter" | "reddit" | "bluesky";

/**
 * Result returned by {@link openShareIntent} so callers can surface the
 * appropriate toast.
 *  - "shared": navigator.share succeeded.
 *  - "opened": an external compose tab was opened.
 *  - "copied": text written to clipboard.
 *  - "failed": no path worked (popup blocked AND clipboard unavailable).
 */
export type ShareResult = "shared" | "opened" | "copied" | "failed";

function buildTwitterUrl(text: string): string {
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

function buildBlueskyUrl(text: string): string {
  return `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`;
}

function buildRedditUrl(text: string): string {
  // Reddit's submit endpoint accepts a title + selftext body. Use the share
  // grid's first line ("PokemonPalette #47 3/4") as the title so it scans
  // well in a feed, and put the emoji grid in the body where formatting
  // preserves line breaks.
  const [titleLine, ...rest] = text.split("\n");
  const body = rest.join("\n").trim();
  const params = new URLSearchParams({
    title: titleLine || "PokemonPalette",
    selftext: "true",
    text: body,
  });
  return `https://www.reddit.com/submit?${params.toString()}`;
}

function openExternal(url: string): boolean {
  if (typeof window === "undefined") return false;
  const w = window.open(url, "_blank", "noopener,noreferrer");
  // Popup blockers return null — the caller falls back to clipboard.
  return w !== null;
}

async function writeClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Open the share intent for the given target. Falls back to clipboard if a
 * popup is blocked or the chosen API is unavailable, so the user always has
 * a way to share even when nothing else works.
 */
export async function openShareIntent(
  target: ShareTarget,
  text: string
): Promise<ShareResult> {
  if (target === "twitter" || target === "reddit" || target === "bluesky") {
    const url =
      target === "twitter"
        ? buildTwitterUrl(text)
        : target === "reddit"
          ? buildRedditUrl(text)
          : buildBlueskyUrl(text);
    if (openExternal(url)) return "opened";
    return (await writeClipboard(text)) ? "copied" : "failed";
  }

  if (target === "native") {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share({ text });
        return "shared";
      } catch {
        // User cancelled the share sheet — fall through to clipboard.
      }
    }
    return (await writeClipboard(text)) ? "copied" : "failed";
  }

  return (await writeClipboard(text)) ? "copied" : "failed";
}

/**
 * Best-effort copy to clipboard, with navigator.share as a mobile-first
 * alternative when available. Retained for backwards compatibility — new
 * callers should prefer {@link openShareIntent} which also handles the
 * explicit platform targets (X, Reddit, Bluesky).
 */
export async function shareOrCopy(text: string): Promise<"shared" | "copied" | "failed"> {
  if (typeof navigator === "undefined") return "failed";

  if (
    typeof navigator.share === "function" &&
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
