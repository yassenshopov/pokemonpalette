"use client";

import { FIRST_DAILY_GAME_DATE } from "@/constants/pokemon";
import { getDailyPoolForDate } from "@/lib/game/daily-pool";

interface GameDateHeaderProps {
  mode: "daily" | "unlimited";
}

export function GameDateHeader({ mode }: GameDateHeaderProps) {
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

  // Active weekly theme — surfaced so players can see "Johto week" / "Hoenn
  // week" and have a reason to return when their favorite region cycles in.
  // Derived client-side because the pool is fully date-deterministic, which
  // sidesteps any wiring through the server fetch hook above.
  const pool = getDailyPoolForDate(today);

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
            title={`This week's daily pool: ${pool.label}`}
          >
            {pool.label}
          </span>
        </div>
      </div>
    </div>
  );
}

