"use client";

import { FIRST_DAILY_GAME_DATE } from "@/constants/pokemon";
import { getDailyPoolForDate } from "@/lib/game/daily-pool";
import type { Difficulty } from "@/lib/game/similarity";

interface GameDateHeaderProps {
  mode: "daily" | "unlimited";
  /**
   * Daily-only — picks which pool label to display. Easy shows the
   * active weekly theme ("Johto week"); hard shows a stable
   * "Full Pokédex" label since the hard track doesn't rotate.
   * Optional so unlimited/multiplayer callers don't need to know.
   */
  difficulty?: Difficulty;
}

export function GameDateHeader({ mode, difficulty = "easy" }: GameDateHeaderProps) {
  if (mode !== "daily") return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(FIRST_DAILY_GAME_DATE);
  startDate.setHours(0, 0, 0, 0);
  const daysDiff = Math.floor(
    (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const gameNumber = daysDiff + 1;
  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Pool label depends on difficulty: easy shows the active weekly theme
  // so loyal players have a reason to return when their favorite region
  // cycles in; hard shows the stable "Full Pokédex" label so the badge
  // communicates the wider pool. Derived client-side because the pool is
  // fully date-deterministic, which sidesteps any wiring through the
  // server fetch hook above.
  const pool = getDailyPoolForDate(today, difficulty);

  return (
    <div className="text-center font-heading">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">
            Game #{gameNumber}
          </span>
        </div>
        <div className="hidden sm:block">•</div>
        <div className="flex items-center gap-2">
          <span>{dateStr}</span>
        </div>
        <div className="hidden sm:block">•</div>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium text-foreground/80"
            title={
              difficulty === "hard"
                ? "Hard mode pulls from the full Pokédex"
                : `This week's daily pool: ${pool.label}`
            }
          >
            {pool.label}
          </span>
        </div>
      </div>
    </div>
  );
}
