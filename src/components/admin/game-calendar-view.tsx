"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DailyPuzzleSheet } from "@/components/admin/daily-puzzle-sheet";
import { GameContributions } from "@/components/admin/game-contributions";
import { GameCalendar } from "@/components/admin/game-calendar";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Hosts both the year-view contribution graph and the month calendar, and
 * owns the single `?date=` URL param that drives the shared detail sheet.
 * Keeping this state at the wrapper level prevents two overlapping sheets
 * when both sub-components open a day.
 */
export function GameCalendarView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlDate = searchParams.get("date");
  const openDate = urlDate && ISO_DATE.test(urlDate) ? urlDate : null;

  const setOpenDate = React.useCallback(
    (iso: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (iso) params.set("date", iso);
      else params.delete("date");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const handleOpen = React.useCallback(
    (iso: string) => setOpenDate(iso),
    [setOpenDate],
  );

  return (
    <div className="space-y-4">
      <GameContributions openDate={openDate} onOpenDate={handleOpen} />
      <GameCalendar openDate={openDate} onOpenDate={handleOpen} />
      <DailyPuzzleSheet
        date={openDate}
        onOpenChange={(open) => {
          if (!open) setOpenDate(null);
        }}
      />
    </div>
  );
}
