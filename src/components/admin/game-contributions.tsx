"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Flame, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toIsoDate } from "@/lib/admin/range";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface DayStat {
  day: string;
  attempts_count: number;
  wins: number;
  unique_players: number;
}

interface GameContributionsProps {
  /** ISO date that is currently selected (for visual highlight). */
  openDate?: string | null;
  /** Open the detail sheet for a given day. */
  onOpenDate: (iso: string) => void;
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const CELL_PX = 12; // visual pixel size of one day
const CELL_GAP_PX = 3;
const ROWS = 7; // Sun..Sat

function yearBounds(year: number): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(year, 0, 1)),
    to: new Date(Date.UTC(year, 11, 31)),
  };
}

/** Build the grid as a list of week columns. Each column has 7 cells indexed
 *  Sun..Sat; out-of-year days are padded with `null`. */
function buildWeeks(
  year: number,
): Array<Array<{ iso: string; date: Date } | null>> {
  const { from, to } = yearBounds(year);
  const startWeekday = from.getUTCDay(); // 0 = Sunday
  const gridStart = new Date(from.getTime() - startWeekday * DAY_MS);
  const endWeekday = to.getUTCDay();
  const gridEnd = new Date(to.getTime() + (6 - endWeekday) * DAY_MS);
  const totalDays = Math.round((gridEnd.getTime() - gridStart.getTime()) / DAY_MS) + 1;
  const totalWeeks = totalDays / ROWS;

  const weeks: Array<Array<{ iso: string; date: Date } | null>> = [];
  for (let w = 0; w < totalWeeks; w++) {
    const col: Array<{ iso: string; date: Date } | null> = [];
    for (let r = 0; r < ROWS; r++) {
      const date = new Date(gridStart.getTime() + (w * ROWS + r) * DAY_MS);
      const inYear = date.getUTCFullYear() === year;
      col.push(inYear ? { iso: toIsoDate(date), date } : null);
    }
    weeks.push(col);
  }
  return weeks;
}

/** GitHub-style 5-level intensity bucket. */
function intensityLevel(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  // Cap at the 85th-percentile-ish heuristic: max*0.85 maps to level 4.
  if (max <= 0) return 0;
  const ratio = count / Math.max(1, max);
  if (ratio < 0.15) return 1;
  if (ratio < 0.35) return 2;
  if (ratio < 0.65) return 3;
  return 4;
}

const INTENSITY_CLASS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-muted/50",
  1: "bg-primary/20",
  2: "bg-primary/40",
  3: "bg-primary/60",
  4: "bg-primary/80",
};

const MONTH_SHORT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});
const FULL_DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

export function GameContributions({
  openDate,
  onOpenDate,
}: GameContributionsProps) {
  const currentYear = new Date().getUTCFullYear();
  const [year, setYear] = React.useState<number>(currentYear);
  const [stats, setStats] = React.useState<Map<string, DayStat>>(new Map());
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const weeks = React.useMemo(() => buildWeeks(year), [year]);
  const todayIso = React.useMemo(() => toIsoDate(new Date()), []);

  const { from, to } = React.useMemo(() => yearBounds(year), [year]);

  const load = React.useCallback(async () => {
    try {
      const params = new URLSearchParams({
        from: toIsoDate(from),
        to: toIsoDate(to),
      });
      const res = await fetch(
        `/api/admin/game-data/calendar?${params.toString()}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to load contributions");
      }
      const data = (await res.json()) as { days: DayStat[] };
      const map = new Map<string, DayStat>();
      for (const d of data.days) map.set(d.day, d);
      setStats(map);
    } catch (err) {
      toast.error((err as Error).message ?? "Couldn’t load contributions");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [from, to]);

  React.useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Aggregates across the visible year.
  const totals = React.useMemo(() => {
    let attempts = 0;
    let wins = 0;
    let daysPlayed = 0;
    let max = 0;
    for (const d of stats.values()) {
      attempts += d.attempts_count;
      wins += d.wins;
      if (d.attempts_count > 0) daysPlayed += 1;
      if (d.attempts_count > max) max = d.attempts_count;
    }
    return { attempts, wins, daysPlayed, max };
  }, [stats]);

  // Streaks — counted across calendar days; only days with at least one play.
  const streaks = React.useMemo(() => {
    let best = 0;
    let current = 0;
    let runningFromToday = 0;
    // Iterate chronologically (weeks are Sun..Sat, left→right).
    const flat: Array<{ iso: string; date: Date } | null> = weeks.flat();
    for (const cell of flat) {
      if (!cell) continue;
      // Only count days up to today (future days never break the streak).
      if (cell.iso > todayIso) continue;
      const played = (stats.get(cell.iso)?.attempts_count ?? 0) > 0;
      if (played) {
        current += 1;
        if (current > best) best = current;
      } else {
        current = 0;
      }
    }
    // Current streak = trailing run ending on today (or yesterday if today unplayed).
    runningFromToday = 0;
    const ordered: string[] = [];
    for (const cell of flat) if (cell) ordered.push(cell.iso);
    for (let i = ordered.length - 1; i >= 0; i--) {
      const iso = ordered[i];
      if (iso === undefined || iso > todayIso) continue;
      const played = (stats.get(iso)?.attempts_count ?? 0) > 0;
      if (played) runningFromToday += 1;
      else break;
    }
    return { best, current: runningFromToday };
  }, [stats, weeks, todayIso]);

  // Month label offsets: a column gets a label if its *first in-year* day
  // starts a new month (or the very first column with an in-year day).
  const monthLabels = React.useMemo(() => {
    const labels: Array<{ col: number; label: string }> = [];
    let lastMonth = -1;
    weeks.forEach((col, idx) => {
      const firstInYear = col.find((c) => c !== null);
      if (!firstInYear) return;
      const m = firstInYear.date.getUTCMonth();
      if (m !== lastMonth) {
        labels.push({ col: idx, label: MONTH_SHORT.format(firstInYear.date) });
        lastMonth = m;
      }
    });
    return labels;
  }, [weeks]);

  const canGoNextYear = year < currentYear;

  return (
    <TooltipProvider delayDuration={120}>
      <Card>
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Previous year"
                onClick={() => setYear((y) => y - 1)}
                className="size-8"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Button>
              <div
                className="min-w-[6rem] px-2 text-center text-sm font-semibold tabular-nums"
                aria-live="polite"
              >
                {year}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Next year"
                onClick={() => setYear((y) => y + 1)}
                disabled={!canGoNextYear}
                className="size-8"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-1 h-8 text-xs"
                onClick={() => setYear(currentYear)}
                disabled={year === currentYear}
              >
                This year
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
              <span>
                <span className="font-medium text-foreground">
                  {totals.attempts.toLocaleString()}
                </span>{" "}
                attempt{totals.attempts === 1 ? "" : "s"}
              </span>
              <span>
                <span className="font-medium text-foreground">
                  {totals.daysPlayed}
                </span>{" "}
                day{totals.daysPlayed === 1 ? "" : "s"} played
              </span>
              <span className="inline-flex items-center gap-1">
                <Flame className="size-3.5" aria-hidden="true" />
                <span className="font-medium text-foreground">
                  {streaks.best}
                </span>{" "}
                longest streak
              </span>
              {year === currentYear && streaks.current > 0 ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Flame className="size-3.5" aria-hidden="true" />
                  {streaks.current}-day streak
                </span>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setRefreshing(true);
                  load();
                }}
                disabled={refreshing || loading}
                aria-label="Refresh contributions"
              >
                <RefreshCw
                  className={cn("size-3.5", refreshing && "animate-spin")}
                  aria-hidden="true"
                />
                <span className="sr-only">Refresh</span>
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div
              role="grid"
              aria-label={`Daily plays for ${year}`}
              className="inline-block min-w-full"
            >
              {/* Month labels */}
              <div
                className="relative ml-[28px] h-4"
                aria-hidden="true"
                style={{
                  width:
                    weeks.length * (CELL_PX + CELL_GAP_PX) - CELL_GAP_PX,
                }}
              >
                {monthLabels.map((m, i) => {
                  const next = monthLabels[i + 1]?.col ?? weeks.length;
                  const widthCols = next - m.col;
                  // Only render if there's enough room for the label.
                  if (widthCols < 2) return null;
                  return (
                    <span
                      key={`${m.label}-${m.col}`}
                      className="absolute top-0 text-[10px] text-muted-foreground"
                      style={{
                        left: m.col * (CELL_PX + CELL_GAP_PX),
                      }}
                    >
                      {m.label}
                    </span>
                  );
                })}
              </div>

              <div className="flex gap-[3px]">
                {/* Weekday labels */}
                <div
                  className="flex flex-col gap-[3px] pr-1"
                  aria-hidden="true"
                >
                  {WEEKDAY_LABELS.map((label, i) => (
                    <div
                      key={i}
                      className="flex items-center text-[10px] leading-none text-muted-foreground"
                      style={{ height: CELL_PX, width: 22 }}
                    >
                      {label}
                    </div>
                  ))}
                </div>

                {/* Week columns */}
                {weeks.map((col, wIdx) => (
                  <div
                    key={wIdx}
                    className="flex flex-col gap-[3px]"
                    role="row"
                  >
                    {col.map((cell, rIdx) => {
                      if (!cell) {
                        return (
                          <div
                            key={rIdx}
                            role="gridcell"
                            aria-hidden="true"
                            className="rounded-[2px] bg-transparent"
                            style={{ width: CELL_PX, height: CELL_PX }}
                          />
                        );
                      }
                      return (
                        <ContribCell
                          key={cell.iso}
                          iso={cell.iso}
                          date={cell.date}
                          stat={stats.get(cell.iso) ?? null}
                          max={totals.max}
                          isToday={cell.iso === todayIso}
                          isFuture={cell.iso > todayIso}
                          isSelected={openDate === cell.iso}
                          onOpen={onOpenDate}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Legend />
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

// --------------------------------------------------------------------------
// Cell
// --------------------------------------------------------------------------

interface ContribCellProps {
  iso: string;
  date: Date;
  stat: DayStat | null;
  max: number;
  isToday: boolean;
  isFuture: boolean;
  isSelected: boolean;
  onOpen: (iso: string) => void;
}

function ContribCell({
  iso,
  date,
  stat,
  max,
  isToday,
  isFuture,
  isSelected,
  onOpen,
}: ContribCellProps) {
  const count = stat?.attempts_count ?? 0;
  const level = intensityLevel(count, max);
  const label =
    count > 0
      ? `${count.toLocaleString()} attempt${count === 1 ? "" : "s"} on ${FULL_DATE.format(date)}`
      : isFuture
        ? `No plays yet on ${FULL_DATE.format(date)}`
        : `No plays on ${FULL_DATE.format(date)}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          role="gridcell"
          onClick={() => onOpen(iso)}
          aria-label={label}
          aria-selected={isSelected || undefined}
          tabIndex={-1}
          className={cn(
            "rounded-[2px] transition-transform hover:scale-[1.3] hover:ring-1 hover:ring-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            // Today is painted brand-red (sampled from the Pokéball logo) so
            // it pops against the heatmap without adding a border.
            isToday ? "bg-brand-red" : INTENSITY_CLASS[level],
            isFuture && count === 0 && !isToday && "opacity-60",
            isSelected && "ring-2 ring-primary",
          )}
          style={{ width: CELL_PX, height: CELL_PX }}
        />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[14rem]">
        <div className="space-y-0.5 text-xs">
          <div className="font-medium">{FULL_DATE.format(date)}</div>
          {count > 0 ? (
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
              <span className="text-muted-foreground">Attempts</span>
              <span className="text-right tabular-nums">
                {count.toLocaleString()}
              </span>
              <span className="text-muted-foreground">Wins</span>
              <span className="text-right tabular-nums">
                {(stat!.wins ?? 0).toLocaleString()}
              </span>
              <span className="text-muted-foreground">Players</span>
              <span className="text-right tabular-nums">
                {(stat!.unique_players ?? 0).toLocaleString()}
              </span>
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground">
              {isFuture ? "Upcoming puzzle." : "No plays."}
            </div>
          )}
          <div className="pt-0.5 text-[11px] text-muted-foreground">
            Click to open details
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// --------------------------------------------------------------------------
// Legend
// --------------------------------------------------------------------------

function Legend() {
  return (
    <div className="flex items-center justify-end gap-1.5 pt-1 text-[11px] text-muted-foreground">
      <span>Less</span>
      {([0, 1, 2, 3, 4] as const).map((level) => (
        <span
          key={level}
          className={cn("rounded-[2px]", INTENSITY_CLASS[level])}
          style={{ width: 10, height: 10 }}
          aria-hidden="true"
        />
      ))}
      <span>More</span>
    </div>
  );
}
