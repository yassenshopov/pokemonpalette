"use client";

import * as React from "react";
import { Calendar, Skull } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DailyPuzzleSheet } from "@/components/admin/daily-puzzle-sheet";
import { GameContributions } from "@/components/admin/game-contributions";
import { GameCalendar } from "@/components/admin/game-calendar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  isDifficulty,
  type Difficulty,
} from "@/lib/game/similarity";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Hosts both the year-view contribution graph and the month calendar, and
 * owns the single `?date=` URL param that drives the shared detail sheet.
 * Keeping this state at the wrapper level prevents two overlapping sheets
 * when both sub-components open a day.
 *
 * Difficulty (`?difficulty=easy|hard`) is also owned here so the toggle
 * affects both the heatmap and the calendar in lockstep — and so the
 * choice survives a refresh / share. Defaults to "easy" to match the
 * historical single-track behavior.
 */
export function GameCalendarView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlDate = searchParams.get("date");
  const openDate = urlDate && ISO_DATE.test(urlDate) ? urlDate : null;

  const urlDifficulty = searchParams.get("difficulty");
  const difficulty: Difficulty = isDifficulty(urlDifficulty)
    ? urlDifficulty
    : "easy";

  /**
   * Build the next URL with selective param overrides. Centralizing this
   * keeps the two consumers (date selection + difficulty toggle) honest
   * about preserving each other's state — flipping the difficulty must
   * NOT close any open sheet, and opening a sheet must NOT reset the
   * difficulty back to easy.
   */
  const pushParams = React.useCallback(
    (next: { date?: string | null; difficulty?: Difficulty }) => {
      const params = new URLSearchParams(searchParams.toString());
      if ("date" in next) {
        if (next.date) params.set("date", next.date);
        else params.delete("date");
      }
      if ("difficulty" in next && next.difficulty) {
        // Don't pollute the URL with the default — easy is implicit.
        if (next.difficulty === "easy") params.delete("difficulty");
        else params.set("difficulty", next.difficulty);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const setOpenDate = React.useCallback(
    (iso: string | null) => pushParams({ date: iso }),
    [pushParams],
  );

  const handleOpen = React.useCallback(
    (iso: string) => setOpenDate(iso),
    [setOpenDate],
  );

  const handleDifficultyChange = React.useCallback(
    (value: string) => {
      if (!isDifficulty(value)) return;
      if (value === difficulty) return;
      pushParams({ difficulty: value });
    },
    [difficulty, pushParams],
  );

  return (
    <div className="space-y-4">
      {/* Difficulty switcher — toggles every downstream consumer (heatmap,
          month grid, detail sheet, override dialog) in one place. We
          render it before the cards so admins see the "scope" of what
          they're about to inspect at the top of the view. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          Showing{" "}
          <span className="font-medium text-foreground">
            {difficulty === "hard" ? "Hard mode" : "Easy mode"}
          </span>{" "}
          stats and overrides
        </div>
        <Tabs value={difficulty} onValueChange={handleDifficultyChange}>
          <TabsList>
            <TabsTrigger
              value="easy"
              className="cursor-pointer text-xs"
              aria-label="Easy mode"
            >
              <Calendar className="mr-1.5 size-3.5" aria-hidden="true" />
              Easy
            </TabsTrigger>
            <TabsTrigger
              value="hard"
              className="cursor-pointer text-xs"
              aria-label="Hard mode"
            >
              <Skull className="mr-1.5 size-3.5" aria-hidden="true" />
              Hard
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <GameContributions
        openDate={openDate}
        onOpenDate={handleOpen}
        difficulty={difficulty}
      />
      <GameCalendar
        openDate={openDate}
        onOpenDate={handleOpen}
        difficulty={difficulty}
      />
      <DailyPuzzleSheet
        date={openDate}
        difficulty={difficulty}
        onOpenChange={(open) => {
          if (!open) setOpenDate(null);
        }}
      />
    </div>
  );
}
