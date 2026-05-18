/**
 * Achievements / badges system for PokémonPalette.
 *
 * MVP design: compute badges on-demand from existing event tables
 * (PokedexEntry, DailyGameAttempt) plus the `user_game_stats` RPC.
 * No new schema, no double-write, no event sourcing — just a pure
 * deriveation from the data we already store.
 *
 * Trade-off: we don't have a record of "when was each badge unlocked",
 * so we can't fire "Badge unlocked!" toasts based on history. For the
 * MVP we surface badges as a wall on /account so players see what
 * they've earned and which ones are next. Real-time unlock toasts are a
 * follow-up (would require an unlock table + diffing).
 *
 * To add a new badge: drop a new entry into BADGE_DEFINITIONS below.
 * Every helper read here happens server-side; no client-side branching
 * on user identity required.
 */
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { logger } from "@/lib/logger";

/** Loose categorization so the UI can group them visually. */
export type BadgeCategory = "catch" | "streak" | "skill" | "variety";

export interface BadgeDefinition {
  /** Stable ID — also used as the React key when listing. */
  id: string;
  category: BadgeCategory;
  name: string;
  /** Short tagline shown under the badge name. */
  description: string;
  /** Threshold the user must hit to unlock. */
  target: number;
  /** Lucide icon name we'll render. */
  icon: BadgeIconKey;
  /** Tailwind text-color class — drives the icon and progress accent. */
  accent: string;
}

/**
 * Subset of lucide-react icons we use for badges. Constraining the union
 * to the icons we've imported keeps the type compiler-checked without
 * pulling the full lucide d.ts surface.
 */
export type BadgeIconKey =
  | "circle-check"
  | "medal"
  | "trophy"
  | "crown"
  | "library"
  | "flame"
  | "calendar"
  | "rocket"
  | "target"
  | "eye"
  | "sparkles";

/**
 * Source-of-truth catalog. Order matters — we render in this order on
 * the account page so progression reads naturally.
 */
export const BADGE_DEFINITIONS: readonly BadgeDefinition[] = [
  // -- Catch milestones (PokedexEntry count) --------------------------------
  {
    id: "bronze_trainer",
    category: "catch",
    name: "Bronze Trainer",
    description: "Catch 10 different Pokémon",
    target: 10,
    icon: "medal",
    accent: "text-amber-600",
  },
  {
    id: "silver_trainer",
    category: "catch",
    name: "Silver Trainer",
    description: "Catch 50 different Pokémon",
    target: 50,
    icon: "medal",
    accent: "text-slate-400",
  },
  {
    id: "gold_trainer",
    category: "catch",
    name: "Gold Trainer",
    description: "Catch 200 different Pokémon",
    target: 200,
    icon: "trophy",
    accent: "text-yellow-500",
  },
  {
    id: "pokemon_master",
    category: "catch",
    name: "Pokémon Master",
    description: "Catch 500 different Pokémon",
    target: 500,
    icon: "crown",
    accent: "text-amber-500",
  },
  {
    id: "living_pokedex",
    category: "catch",
    name: "Living Pokédex",
    description: "Catch 1,000 different Pokémon",
    target: 1000,
    icon: "library",
    accent: "text-emerald-500",
  },
  // -- Streak milestones (user_game_stats.longestStreak) --------------------
  {
    id: "daily_habit",
    category: "streak",
    name: "Daily Habit",
    description: "Win a 7-day daily streak",
    target: 7,
    icon: "calendar",
    accent: "text-orange-500",
  },
  {
    id: "iron_will",
    category: "streak",
    name: "Iron Will",
    description: "Win a 30-day daily streak",
    target: 30,
    icon: "flame",
    accent: "text-red-500",
  },
  {
    id: "two_month_marathon",
    category: "streak",
    name: "Two-Month Marathon",
    description: "Win a 60-day daily streak",
    target: 60,
    icon: "rocket",
    accent: "text-purple-500",
  },
  // -- Skill (one-shot DailyGameAttempt conditions) -------------------------
  {
    id: "first_try_genius",
    category: "skill",
    name: "First-Try Genius",
    description: "Win a daily on your first guess",
    target: 1,
    icon: "target",
    accent: "text-sky-500",
  },
  {
    id: "sharp_eye",
    category: "skill",
    name: "Sharp Eye",
    description: "Win a daily without revealing any hints",
    target: 1,
    icon: "eye",
    accent: "text-indigo-500",
  },
  // -- Variety --------------------------------------------------------------
  {
    id: "shiny_hunter",
    category: "variety",
    name: "Shiny Hunter",
    description: "Catch your first shiny Pokémon",
    target: 1,
    icon: "sparkles",
    accent: "text-fuchsia-500",
  },
];

export interface BadgeProgress {
  id: string;
  unlocked: boolean;
  current: number;
  target: number;
  /** 0..1 progress ratio, capped at 1.0 once unlocked. */
  ratio: number;
}

/**
 * Empty progress used when stats aren't available (anon visitor, RPC
 * failure, etc.). Returns every badge at zero so the UI can still show
 * the wall as "everything to play for".
 */
export function emptyBadgeProgress(): BadgeProgress[] {
  return BADGE_DEFINITIONS.map((b) => ({
    id: b.id,
    unlocked: false,
    current: 0,
    target: b.target,
    ratio: 0,
  }));
}

/**
 * Evaluate every badge for a user. Returns a parallel array matching
 * BADGE_DEFINITIONS ordering (same length, same indices, same ids).
 *
 * Cost: 4 cheap queries + 1 RPC. Indexed by (user_id) and (user_id,
 * won) on daily_game_attempts; (user_id) on pokedex_entries. Safe to
 * call from a server component.
 */
export async function evaluateBadges(
  userId: string,
): Promise<BadgeProgress[]> {
  try {
    const [
      pokedexTotal,
      shinyTotal,
      firstTryWins,
      noHintWins,
      stats,
    ] = await Promise.all([
      prisma.pokedexEntry.count({ where: { userId } }),
      prisma.pokedexEntry.count({ where: { userId, isShiny: true } }),
      prisma.dailyGameAttempt.count({
        where: { userId, won: true, attempts: 1 },
      }),
      prisma.dailyGameAttempt.count({
        where: { userId, won: true, hintsUsed: 0 },
      }),
      // user_game_stats returns { currentStreak, longestStreak, ... } as
      // jsonb. We only care about longestStreak for streak badges —
      // longest beats current here because "I once had a 30-day streak"
      // is a permanent achievement regardless of today's state. Pinned
      // to the 'easy' track so existing badges (earned on the historical
      // single-difficulty schedule) don't suddenly require a hard-mode
      // streak. Hard-mode-specific badges can be a follow-up.
      supabaseAdmin
        .rpc("user_game_stats", { p_user_id: userId, p_difficulty: "easy" })
        .then((res) => res.data as { longestStreak?: number } | null),
    ]);

    const longestStreak = Number(stats?.longestStreak ?? 0);

    return BADGE_DEFINITIONS.map((b) => {
      const current = currentValueFor(b.id, {
        pokedexTotal,
        shinyTotal,
        firstTryWins,
        noHintWins,
        longestStreak,
      });
      const unlocked = current >= b.target;
      const ratio = Math.min(1, current / b.target);
      return {
        id: b.id,
        unlocked,
        current,
        target: b.target,
        ratio,
      };
    });
  } catch (err) {
    // Badge evaluation is decorative — if it fails the rest of the page
    // should still load. Log and return empty progress so the UI shows
    // "0/target" for every badge.
    logger.error("badges.evaluate_failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return emptyBadgeProgress();
  }
}

interface BadgeInputs {
  pokedexTotal: number;
  shinyTotal: number;
  firstTryWins: number;
  noHintWins: number;
  longestStreak: number;
}

/**
 * Map a badge id to its "current" value from the precomputed inputs.
 * Co-located with the catalog so adding a new badge is a one-place
 * edit — append to BADGE_DEFINITIONS and add a case here.
 */
function currentValueFor(id: string, inputs: BadgeInputs): number {
  switch (id) {
    case "bronze_trainer":
    case "silver_trainer":
    case "gold_trainer":
    case "pokemon_master":
    case "living_pokedex":
      return inputs.pokedexTotal;
    case "daily_habit":
    case "iron_will":
    case "two_month_marathon":
      return inputs.longestStreak;
    case "first_try_genius":
      return inputs.firstTryWins;
    case "sharp_eye":
      return inputs.noHintWins;
    case "shiny_hunter":
      return inputs.shinyTotal;
    default:
      return 0;
  }
}
