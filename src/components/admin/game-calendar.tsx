"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarX,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toIsoDate } from "@/lib/admin/range";

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
}

export function GameCalendar({ initialMonth }: GameCalendarProps) {
  const router = useRouter();
  const [anchor, setAnchor] = React.useState<Date>(() => {
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

  const goAttempts = (iso: string) => {
    router.push(`/admin/game?view=attempts&date_from=${iso}&date_to=${iso}`);
  };

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
                {monthTotals.puzzles} puzzle{monthTotals.puzzles === 1 ? "" : "s"}
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
              return (
                <CalendarCell
                  key={iso}
                  iso={iso}
                  date={date}
                  data={data}
                  maxAttempts={maxAttempts}
                  muted={!inMonth}
                  isToday={isToday}
                  isFuture={isFuture}
                  loading={loading}
                  onOpen={goAttempts}
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
  data: CalendarDay | undefined;
  maxAttempts: number;
  muted: boolean;
  isToday: boolean;
  isFuture: boolean;
  loading: boolean;
  onOpen: (iso: string) => void;
}

function CalendarCell({
  iso,
  date,
  data,
  maxAttempts,
  muted,
  isToday,
  isFuture,
  loading,
  onOpen,
}: CalendarCellProps) {
  const hasData = !!data && data.attempts_count > 0;
  const ratio =
    hasData && maxAttempts > 0 ? data!.attempts_count / maxAttempts : 0;
  const winRate =
    data && data.attempts_count > 0
      ? (data.wins / data.attempts_count) * 100
      : 0;

  const dayNum = dayNumberFormatter.format(date);

  const body = (
    <div
      role="gridcell"
      aria-selected={isToday ? "true" : undefined}
      aria-label={`${fullDateFormatter.format(date)}${
        data
          ? `: ${data.attempts_count} attempts, ${winRate.toFixed(0)}% win rate`
          : isFuture
            ? ": upcoming"
            : ": no attempts"
      }`}
      className={cn(
        "group relative aspect-square min-h-[80px] overflow-hidden rounded-md border text-left transition-colors",
        muted ? "opacity-40" : "",
        isToday ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "",
        isFuture
          ? "border-dashed bg-muted/30 text-muted-foreground"
          : hasData
            ? cn(heatClass(ratio), "hover:ring-1 hover:ring-primary/50")
            : "bg-muted/20 hover:bg-muted/40",
      )}
    >
      <div className="flex items-start justify-between gap-1 p-1.5">
        <span
          className={cn(
            "text-[11px] font-semibold tabular-nums",
            isToday && "text-primary",
          )}
        >
          {dayNum}
        </span>
        {data && data.attempts_count > 0 ? (
          <span className="rounded bg-background/80 px-1 text-[10px] font-medium tabular-nums text-foreground backdrop-blur-sm">
            {data.attempts_count}
          </span>
        ) : null}
      </div>
      {data?.target_pokemon_id ? (
        <div className="pointer-events-none absolute bottom-0.5 left-1/2 size-[44px] -translate-x-1/2">
          <Image
            src={officialArtworkUrl(data.target_pokemon_id)}
            alt=""
            fill
            sizes="44px"
            className="object-contain drop-shadow-sm"
            unoptimized
          />
        </div>
      ) : isFuture ? null : loading ? (
        <div className="absolute inset-x-2 bottom-2">
          <Skeleton className="h-4 w-full" />
        </div>
      ) : (
        <div className="absolute inset-x-0 bottom-1 flex justify-center">
          <CalendarX
            className="size-3 text-muted-foreground/50"
            aria-hidden="true"
          />
        </div>
      )}
      {data && data.attempts_count > 0 ? (
        <div className="absolute inset-x-1 bottom-1 flex items-center justify-end">
          <span
            className={cn(
              "rounded bg-background/70 px-1 text-[10px] font-medium tabular-nums backdrop-blur-sm",
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

  if (isFuture || !hasData) {
    return body;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onOpen(iso)}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          {body}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[14rem]">
        <div className="space-y-0.5 text-xs">
          <div className="font-medium">{fullDateFormatter.format(date)}</div>
          <div className="text-muted-foreground">
            #{data!.target_pokemon_id.toString().padStart(4, "0")}
          </div>
          <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5">
            <span className="text-muted-foreground">Attempts</span>
            <span className="text-right tabular-nums">
              {data!.attempts_count.toLocaleString()}
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
          <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <ExternalLink className="size-3" aria-hidden="true" />
            Click to see attempts
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
