"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Trophy,
  Users,
} from "lucide-react";
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
import {
  DAILY_POOL_SIZE,
  getDailyPokemonIdForDate,
} from "@/lib/game/similarity";

interface CalendarDay {
  day: string;
  target_pokemon_id: number;
  attempts_count: number;
  wins: number;
  unique_players: number;
  avg_attempts: number;
}

function officialArtworkUrl(pokemonId: number) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonId}.png`;
}

function monthLabel(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function monthBounds(anchor: Date): { from: Date; to: Date } {
  const from = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1),
  );
  const to = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0),
  );
  return { from, to };
}

function buildGrid(anchor: Date): Array<{ date: Date; inMonth: boolean }> {
  const { from } = monthBounds(anchor);
  const startWeekday = from.getUTCDay(); // 0 = Sunday
  const gridStart = new Date(from.getTime() - startWeekday * 24 * 60 * 60 * 1000);
  // Show 6 weeks (42 days) for a stable grid height.
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart.getTime() + i * 24 * 60 * 60 * 1000);
    return { date, inMonth: date.getUTCMonth() === anchor.getUTCMonth() };
  });
}

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

interface GameCalendarProps {
  /** Initial month anchor; defaults to the current month. */
  initialMonth?: Date;
  /** Currently-selected ISO date (for visual highlight). */
  openDate?: string | null;
  /** Open the detail sheet for a given day. */
  onOpenDate: (iso: string) => void;
}

export function GameCalendar({
  initialMonth,
  openDate,
  onOpenDate,
}: GameCalendarProps) {
  const [anchor, setAnchor] = React.useState<Date>(() => {
    // If the caller provides an `openDate`, anchor the calendar on that
    // month so deep-links land on the right page; otherwise fall back to
    // the explicit initialMonth or today.
    if (openDate) {
      const d = new Date(`${openDate}T00:00:00Z`);
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    }
    const d = initialMonth ?? new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  });
  const [days, setDays] = React.useState<Map<string, CalendarDay>>(new Map());
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const { from, to } = React.useMemo(() => monthBounds(anchor), [anchor]);
  const todayIso = React.useMemo(() => toIsoDate(new Date()), []);
  const isFutureMonth = React.useMemo(() => {
    const now = new Date();
    const currentMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    return anchor.getTime() > currentMonthStart.getTime();
  }, [anchor]);

  const load = React.useCallback(async () => {
    try {
      const params = new URLSearchParams({
        from: toIsoDate(from),
        to: toIsoDate(to),
      });
      const res = await fetch(`/api/admin/game-data/calendar?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to load calendar");
      }
      const data = (await res.json()) as { days: CalendarDay[] };
      const map = new Map<string, CalendarDay>();
      for (const d of data.days) map.set(d.day, d);
      setDays(map);
    } catch (err) {
      toast.error((err as Error).message ?? "Couldn’t load calendar");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [from, to]);

  React.useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const grid = React.useMemo(() => buildGrid(anchor), [anchor]);
  const maxAttempts = React.useMemo(() => {
    let max = 0;
    for (const d of days.values()) {
      if (d.attempts_count > max) max = d.attempts_count;
    }
    return max;
  }, [days]);

  const goToMonth = (delta: number) => {
    setAnchor((prev) => {
      const next = new Date(
        Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() + delta, 1),
      );
      return next;
    });
  };

  const monthTotals = React.useMemo(() => {
    let attempts = 0;
    let wins = 0;
    let puzzles = 0;
    for (const d of days.values()) {
      attempts += d.attempts_count;
      wins += d.wins;
      puzzles += 1;
    }
    return { attempts, wins, puzzles };
  }, [days]);


  return (
    <TooltipProvider delayDuration={150}>
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Previous month"
                onClick={() => goToMonth(-1)}
                className="size-8"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Button>
              <div
                className="min-w-[10rem] px-2 text-center text-sm font-semibold tabular-nums"
                aria-live="polite"
              >
                {monthLabel(anchor)}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Next month"
                onClick={() => goToMonth(1)}
                className="size-8"
                disabled={isFutureMonth}
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-1 h-8 text-xs"
                onClick={() => {
                  const now = new Date();
                  setAnchor(
                    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
                  );
                }}
              >
                Today
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground tabular-nums">
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5" aria-hidden="true" />
                {monthTotals.puzzles} day{monthTotals.puzzles === 1 ? "" : "s"}{" "}
                played
              </span>
              <span>{monthTotals.attempts.toLocaleString()} attempts</span>
              <span className="inline-flex items-center gap-1">
                <Trophy className="size-3.5" aria-hidden="true" />
                {monthTotals.attempts
                  ? `${((monthTotals.wins / monthTotals.attempts) * 100).toFixed(1)}%`
                  : "—"}
              </span>
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
                aria-label="Refresh calendar"
              >
                <RefreshCw
                  className={cn("size-3.5", refreshing && "animate-spin")}
                  aria-hidden="true"
                />
                <span className="sr-only">Refresh</span>
              </Button>
            </div>
          </div>

          <div
            role="grid"
            aria-label={`${monthLabel(anchor)} calendar`}
            className="grid grid-cols-7 gap-1.5"
          >
            {WEEKDAY_LABELS.map((label, i) => (
              <div
                key={`h-${i}`}
                className="px-1 pb-1 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                role="columnheader"
              >
                {label}
              </div>
            ))}
            {grid.map(({ date, inMonth }) => {
              const iso = toIsoDate(date);
              const data = days.get(iso);
              const isToday = iso === todayIso;
              const isFuture = iso > todayIso;
              // Deterministic daily target — mirrors the formula used in
              // /game so every day (including future + unplayed) has a
              // known Pokemon to display.
              const targetId =
                data?.target_pokemon_id ??
                getDailyPokemonIdForDate(date, DAILY_POOL_SIZE, false);
              return (
                <CalendarCell
                  key={iso}
                  iso={iso}
                  date={date}
                  targetId={targetId}
                  data={data}
                  maxAttempts={maxAttempts}
                  muted={!inMonth}
                  isToday={isToday}
                  isFuture={isFuture}
                  isSelected={openDate === iso}
                  onOpen={onOpenDate}
                />
              );
            })}
          </div>

          <CalendarLegend />
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

function heatClass(ratio: number): string {
  if (ratio <= 0) return "bg-muted/40";
  if (ratio < 0.2) return "bg-primary/10";
  if (ratio < 0.4) return "bg-primary/25";
  if (ratio < 0.6) return "bg-primary/40";
  if (ratio < 0.8) return "bg-primary/60";
  return "bg-primary/80";
}

const dayNumberFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  timeZone: "UTC",
});
const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

interface CalendarCellProps {
  iso: string;
  date: Date;
  targetId: number;
  data: CalendarDay | undefined;
  maxAttempts: number;
  muted: boolean;
  isToday: boolean;
  isFuture: boolean;
  isSelected: boolean;
  onOpen: (iso: string) => void;
}

function CalendarCell({
  iso,
  date,
  targetId,
  data,
  maxAttempts,
  muted,
  isToday,
  isFuture,
  isSelected,
  onOpen,
}: CalendarCellProps) {
  const attemptsCount = data?.attempts_count ?? 0;
  const hasData = attemptsCount > 0;
  const ratio = hasData && maxAttempts > 0 ? attemptsCount / maxAttempts : 0;
  const winRate = hasData ? (data!.wins / attemptsCount) * 100 : 0;

  const dayNum = dayNumberFormatter.format(date);

  const body = (
    <div
      role="gridcell"
      aria-selected={isToday ? "true" : undefined}
      aria-label={`${fullDateFormatter.format(date)}${
        hasData
          ? `: ${attemptsCount} attempts, ${winRate.toFixed(0)}% win rate`
          : isFuture
            ? ": upcoming"
            : ": no attempts"
      }`}
      className={cn(
        "group relative aspect-square min-h-[80px] overflow-hidden rounded-md border text-left transition-colors",
        muted ? "opacity-40" : "",
        isToday
          ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
          : "",
        !isToday && isSelected
          ? "ring-2 ring-primary/80 ring-offset-1 ring-offset-background"
          : "",
        isFuture
          ? "border-dashed bg-muted/20"
          : hasData
            ? cn(heatClass(ratio), "hover:ring-1 hover:ring-primary/50")
            : "bg-muted/10 hover:bg-muted/30",
      )}
    >
      {/* Silhouette sprite fills the whole square. */}
      <div className="pointer-events-none absolute inset-1">
        <Image
          src={officialArtworkUrl(targetId)}
          alt=""
          fill
          sizes="96px"
          className={cn(
            "object-contain transition-opacity",
            // `brightness-0` → pure black silhouette; `dark:invert` flips it
            // to white on dark backgrounds. Slightly softened for readability.
            "brightness-0 dark:invert",
            isFuture ? "opacity-25" : hasData ? "opacity-55" : "opacity-40",
          )}
          unoptimized
        />
      </div>

      {/* Day number — top-left pill. */}
      <div className="absolute left-1 top-1">
        <span
          className={cn(
            "rounded bg-background/75 px-1 text-[11px] font-semibold tabular-nums text-foreground backdrop-blur-sm",
            isToday && "bg-primary text-primary-foreground",
          )}
        >
          {dayNum}
        </span>
      </div>

      {/* Attempts count — top-right pill, always shown. */}
      <div className="absolute right-1 top-1">
        <span
          className={cn(
            "rounded px-1 text-[10px] font-medium tabular-nums backdrop-blur-sm",
            hasData
              ? "bg-background/80 text-foreground"
              : "bg-background/60 text-muted-foreground",
          )}
          aria-label={`${attemptsCount} plays`}
        >
          {attemptsCount.toLocaleString()}
        </span>
      </div>

      {/* Win rate — bottom-right pill, only when we have data. */}
      {hasData ? (
        <div className="absolute bottom-1 right-1">
          <span
            className={cn(
              "rounded bg-background/80 px-1 text-[10px] font-medium tabular-nums backdrop-blur-sm",
              winRate >= 66
                ? "text-emerald-600 dark:text-emerald-400"
                : winRate >= 33
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-rose-600 dark:text-rose-400",
            )}
          >
            {winRate.toFixed(0)}%
          </span>
        </div>
      ) : null}
    </div>
  );

  // Every cell is clickable — the sheet handles empty / upcoming states so
  // admins can still preview the deterministic target for those days.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onOpen(iso)}
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          aria-label={`Open details for ${fullDateFormatter.format(date)}`}
        >
          {body}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[14rem]">
        <div className="space-y-0.5 text-xs">
          <div className="font-medium">{fullDateFormatter.format(date)}</div>
          <div className="text-muted-foreground">
            Target{" "}
            <span className="font-mono tabular-nums" translate="no">
              #{targetId.toString().padStart(4, "0")}
            </span>
          </div>
          {hasData ? (
            <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5">
              <span className="text-muted-foreground">Attempts</span>
              <span className="text-right tabular-nums">
                {attemptsCount.toLocaleString()}
              </span>
              <span className="text-muted-foreground">Win rate</span>
              <span className="text-right tabular-nums">
                {winRate.toFixed(1)}%
              </span>
              <span className="text-muted-foreground">Avg attempts</span>
              <span className="text-right tabular-nums">
                {Number(data!.avg_attempts).toFixed(2)}
              </span>
              <span className="text-muted-foreground">Players</span>
              <span className="text-right tabular-nums">
                {data!.unique_players.toLocaleString()}
              </span>
            </div>
          ) : (
            <div className="mt-1 text-[11px] text-muted-foreground">
              {isFuture
                ? "Upcoming puzzle — no plays yet."
                : "No plays on this day."}
            </div>
          )}
          <div className="mt-1 text-[11px] text-muted-foreground">
            Click to open details
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span>Low</span>
        <span className="inline-block size-3 rounded-sm bg-primary/10" aria-hidden />
        <span className="inline-block size-3 rounded-sm bg-primary/25" aria-hidden />
        <span className="inline-block size-3 rounded-sm bg-primary/40" aria-hidden />
        <span className="inline-block size-3 rounded-sm bg-primary/60" aria-hidden />
        <span className="inline-block size-3 rounded-sm bg-primary/80" aria-hidden />
        <span>High</span>
      </div>
      <Link
        href="/admin/game?view=daily"
        className="hover:underline"
      >
        View daily table →
      </Link>
    </div>
  );
}
