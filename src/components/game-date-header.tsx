"use client";

import { FIRST_DAILY_GAME_DATE } from "@/constants/pokemon";

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
      </div>
    </div>
  );
}

