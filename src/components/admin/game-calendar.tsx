"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Pin,
  RefreshCw,
  Sparkles,
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
import { pickDailyPokemonId } from "@/lib/game/daily-pool";
import { getPokemonById } from "@/lib/pokemon";
import type { ColorPalette } from "@/types/pokemon";
import type { Difficulty } from "@/lib/game/similarity";
import { DAILY_OVERRIDE_CHANGED_EVENT } from "@/components/admin/daily-puzzle-sheet";

interface CalendarDay {
  day: string;
  target_pokemon_id: number;
  attempts_count: number;
  wins: number;
  unique_players: number;
  avg_attempts: number;
}

interface OverrideRow {
  date: string;
  pokemon_id: number;
  is_shiny: boolean;
  note: string | null;
}

interface PokemonPalettes {
  normal: ColorPalette | null;
  shiny: ColorPalette | null;
}

function officialArtworkUrl(pokemonId: number, shiny = false) {
  const suffix = shiny ? "/shiny" : "";
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork${suffix}/${pokemonId}.png`;
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
  // Week starts on Monday: shift Sunday (0) to the last column (offset 6).
  const startOffset = (from.getUTCDay() + 6) % 7;
  const gridStart = new Date(from.getTime() - startOffset * 24 * 60 * 60 * 1000);
  // Show 6 weeks (42 days) for a stable grid height.
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart.getTime() + i * 24 * 60 * 60 * 1000);
    return { date, inMonth: date.getUTCMonth() === anchor.getUTCMonth() };
  });
}

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

interface GameCalendarProps {
  /** Initial month anchor; defaults to the current month. */
  initialMonth?: Date;
  /** Currently-selected ISO date (for visual highlight). */
  openDate?: string | null;
  /** Open the detail sheet for a given day. */
  onOpenDate: (iso: string) => void;
  /**
   * Which difficulty track to render — drives both the per-day stats
   * (calendar RPC is now filtered by difficulty) and the overrides
   * map (each (date, difficulty) pair has its own override row).
   * Defaults to "easy" so legacy callers behave as before.
   */
  difficulty?: Difficulty;
}

export function GameCalendar({
  initialMonth,
  openDate,
  onOpenDate,
  difficulty = "easy",
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
  const [overrides, setOverrides] = React.useState<Map<string, OverrideRow>>(
    new Map(),
  );
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const { from, to } = React.useMemo(() => monthBounds(anchor), [anchor]);
  // The grid renders 6 weeks (42 cells) starting from the Monday on/before
  // the first of the month. We fetch stats + overrides across the full grid
  // so leading/trailing days from adjacent months still show real data.
  const { gridFrom, gridTo } = React.useMemo(() => {
    const startOffset = (from.getUTCDay() + 6) % 7;
    const start = new Date(from.getTime() - startOffset * 86_400_000);
    const end = new Date(start.getTime() + 41 * 86_400_000);
    return { gridFrom: start, gridTo: end };
  }, [from]);
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
      // Fetch stats + overrides across the full visible grid so leading and
      // trailing days from adjacent months also render with real data.
      // Both endpoints are scoped to `difficulty` so easy and hard render
      // their own (independent) attempt counts, win rates, and pinned
      // overrides without one bleeding into the other.
      const params = new URLSearchParams({
        from: toIsoDate(gridFrom),
        to: toIsoDate(gridTo),
        difficulty,
      });
      const [calRes, overrideRes] = await Promise.all([
        fetch(`/api/admin/game-data/calendar?${params.toString()}`, {
          cache: "no-store",
        }),
        fetch(`/api/admin/daily-overrides?${params.toString()}`, {
          cache: "no-store",
        }),
      ]);
      if (!calRes.ok) {
        const data = await calRes.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to load calendar");
      }
      const calData = (await calRes.json()) as { days: CalendarDay[] };
      const map = new Map<string, CalendarDay>();
      for (const d of calData.days) map.set(d.day, d);
      setDays(map);

      // Override fetch failure is non-fatal — the calendar still renders
      // without badges. Surface a soft toast but keep the existing data.
      if (overrideRes.ok) {
        const overrideData = (await overrideRes.json()) as {
          overrides: OverrideRow[];
        };
        const omap = new Map<string, OverrideRow>();
        for (const o of overrideData.overrides) omap.set(o.date, o);
        setOverrides(omap);
      } else {
        setOverrides(new Map());
      }
    } catch (err) {
      toast.error((err as Error).message ?? "Couldn’t load calendar");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [gridFrom, gridTo, difficulty]);

  React.useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Refresh overrides when the daily puzzle sheet broadcasts a change.
  // We re-run the full loader so the override map and silhouettes stay
  // in lockstep with the calendar data.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => load();
    window.addEventListener(DAILY_OVERRIDE_CHANGED_EVENT, handler);
    return () =>
      window.removeEventListener(DAILY_OVERRIDE_CHANGED_EVENT, handler);
  }, [load]);

  const grid = React.useMemo(() => buildGrid(anchor), [anchor]);

  // Resolve the target Pokemon id for every visible cell up front, mirroring
  // the per-cell resolution order: recorded plays → admin override → deterministic.
  // The deterministic fallback is seeded with `difficulty` because the easy
  // and hard tracks pick from different pools (themed-week vs. full
  // Pokédex) — rendering the easy pick on a hard cell would mislead admins.
  const targetByIso = React.useMemo(() => {
    const map = new Map<string, { id: number; shiny: boolean }>();
    for (const { date } of grid) {
      const iso = toIsoDate(date);
      const data = days.get(iso);
      const override = overrides.get(iso);
      const id =
        data?.target_pokemon_id ??
        override?.pokemon_id ??
        pickDailyPokemonId(date, false, difficulty);
      map.set(iso, { id, shiny: override?.is_shiny ?? false });
    }
    return map;
  }, [grid, days, overrides, difficulty]);

  // Batch-fetch palettes for unique target ids in the visible grid. Results
  // are cached in `getPokemonById` so subsequent month navigation is cheap.
  const [palettes, setPalettes] = React.useState<Map<number, PokemonPalettes>>(
    new Map(),
  );
  React.useEffect(() => {
    let cancelled = false;
    const uniqueIds = Array.from(
      new Set(Array.from(targetByIso.values()).map((t) => t.id)),
    );
    if (uniqueIds.length === 0) return;
    Promise.all(uniqueIds.map((id) => getPokemonById(id))).then((results) => {
      if (cancelled) return;
      setPalettes((prev) => {
        const next = new Map(prev);
        results.forEach((p, i) => {
          if (!p) return;
          const id = uniqueIds[i];
          if (id === undefined) return;
          next.set(id, {
            normal: p.colorPalette ?? null,
            shiny: p.shinyColorPalette ?? null,
          });
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [targetByIso]);

  const goToMonth = (delta: number) => {
    setAnchor((prev) => {
      const next = new Date(
        Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() + delta, 1),
      );
      return next;
    });
  };

  const monthTotals = React.useMemo(() => {
    // Restrict totals to the anchor month since `days` now covers the full
    // 42-day grid (including leading/trailing cells from adjacent months).
    const monthKey = `${anchor.getUTCFullYear()}-${String(
      anchor.getUTCMonth() + 1,
    ).padStart(2, "0")}`;
    let attempts = 0;
    let wins = 0;
    let puzzles = 0;
    for (const [iso, d] of days) {
      if (!iso.startsWith(monthKey)) continue;
      attempts += d.attempts_count;
      wins += d.wins;
      puzzles += 1;
    }
    return { attempts, wins, puzzles };
  }, [days, anchor]);


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
              const override = overrides.get(iso);
              const isToday = iso === todayIso;
              const isFuture = iso > todayIso;
              const resolved = targetByIso.get(iso);
              const targetId = resolved?.id ?? 0;
              const palettes_ = palettes.get(targetId);
              const palette =
                (resolved?.shiny ? palettes_?.shiny : palettes_?.normal) ??
                palettes_?.normal ??
                null;
              return (
                <CalendarCell
                  key={iso}
                  iso={iso}
                  date={date}
                  targetId={targetId}
                  data={data}
                  override={override ?? null}
                  palette={palette}
                  muted={!inMonth}
                  isToday={isToday}
                  isFuture={isFuture}
                  isSelected={openDate === iso}
                  loading={loading}
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

function winRateTextClass(rate: number): string {
  if (rate >= 66) return "text-emerald-600 dark:text-emerald-400";
  if (rate >= 33) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

interface CalendarCellProps {
  iso: string;
  date: Date;
  targetId: number;
  data: CalendarDay | undefined;
  override: OverrideRow | null;
  palette: ColorPalette | null;
  muted: boolean;
  isToday: boolean;
  isFuture: boolean;
  isSelected: boolean;
  loading: boolean;
  onOpen: (iso: string) => void;
}

function paletteSwatchColors(palette: ColorPalette | null): string[] {
  if (!palette) return [];
  // Prefer the extractor highlights (ordered by prevalence) so the swatch
  // matches what players see at game time; fall back to primary/secondary/accent.
  const ordered = [
    ...(palette.highlights ?? []),
    palette.primary,
    palette.secondary,
    palette.accent,
  ].filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const hex of ordered) {
    const key = hex.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hex);
    if (out.length === 3) break;
  }
  return out;
}

function CalendarCell({
  iso,
  date,
  targetId,
  data,
  override,
  palette,
  muted,
  isToday,
  isFuture,
  isSelected,
  loading,
  onOpen,
}: CalendarCellProps) {
  const attemptsCount = data?.attempts_count ?? 0;
  const hasData = attemptsCount > 0;
  const winRate = hasData ? (data!.wins / attemptsCount) * 100 : 0;

  const dayNum = dayNumberFormatter.format(date);

  const hasOverride = Boolean(override);
  const overrideShiny = override?.is_shiny ?? false;

  const body = (
    <div
      role="gridcell"
      aria-selected={isToday ? "true" : undefined}
      aria-label={`${fullDateFormatter.format(date)}${
        loading
          ? ": loading"
          : hasData
            ? `: ${attemptsCount} attempts, ${winRate.toFixed(0)}% win rate`
            : isFuture
              ? ": upcoming"
              : ": no attempts"
      }${hasOverride ? ", admin override active" : ""}`}
      className={cn(
        "group relative aspect-square min-h-[80px] overflow-hidden rounded-md border text-left transition-colors",
        muted && "opacity-50",
        // Today is washed in brand red (sampled from the Pokéball logo)
        // instead of a ring outline — calmer at a glance, still distinctive.
        isToday
          ? "border-brand-red/50 bg-brand-red/12"
          : isFuture
            ? "border-dashed bg-muted/20"
            : "bg-muted/10 hover:bg-muted/30",
        isSelected && "ring-2 ring-primary/80 ring-offset-1 ring-offset-background",
        // Admin override gets a warm border accent so the pinned schedule is
        // visible at a glance even before the corner pin lands.
        hasOverride && !isToday && !isSelected &&
          "border-amber-500/60 dark:border-amber-400/50",
      )}
    >
      <div className="pointer-events-none absolute inset-1">
        <Image
          src={officialArtworkUrl(targetId, overrideShiny)}
          alt=""
          fill
          sizes="96px"
          className={cn(
            "object-contain transition-opacity",
            // `brightness-0` → pure black silhouette; `dark:invert` flips it
            // to white on dark backgrounds. Slightly softened for readability.
            "brightness-0 dark:invert",
            isFuture ? "opacity-25" : hasData ? "opacity-50" : "opacity-35",
          )}
          unoptimized
        />
      </div>

      {/* Top row: day number + override badges on the left, palette swatch on the right. */}
      <div className="absolute inset-x-1 top-1 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          <span
            className={cn(
              "rounded bg-background/75 px-1 text-[11px] font-semibold tabular-nums text-foreground backdrop-blur-sm",
              isToday && "bg-brand-red text-white",
            )}
          >
            {dayNum}
          </span>
          {hasOverride ? (
            <span
              className="inline-flex size-4 items-center justify-center rounded-full bg-amber-500 text-amber-50 shadow-sm"
              aria-label="Admin override"
              title="Admin override"
            >
              <Pin className="size-2.5" aria-hidden="true" />
            </span>
          ) : null}
          {hasOverride && overrideShiny ? (
            <Sparkles
              className="size-3 text-amber-500 drop-shadow"
              aria-label="Shiny override"
            />
          ) : null}
        </div>
        <PaletteSwatch palette={palette} muted={isFuture} />
      </div>

      {/* Bottom row: labeled play / win-rate stats (or a skeleton while loading). */}
      <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1 rounded bg-background/80 px-1 py-0.5 text-[10px] backdrop-blur-sm">
        {loading ? (
          <span
            className="block h-3 w-full animate-pulse rounded bg-muted/70"
            aria-hidden="true"
          />
        ) : (
          <>
            <span
              className="inline-flex items-center gap-0.5 text-muted-foreground"
              title={`${attemptsCount} play${attemptsCount === 1 ? "" : "s"}`}
            >
              <Users className="size-2.5" aria-hidden="true" />
              <span
                className={cn(
                  "tabular-nums",
                  hasData ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {attemptsCount.toLocaleString()}
              </span>
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-0.5",
                hasData ? winRateTextClass(winRate) : "text-muted-foreground",
              )}
              title={hasData ? `${winRate.toFixed(0)}% win rate` : "No plays"}
            >
              <Trophy className="size-2.5" aria-hidden="true" />
              <span className="tabular-nums">
                {hasData ? `${winRate.toFixed(0)}%` : "—"}
              </span>
            </span>
          </>
        )}
      </div>
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
            {overrideShiny ? " (shiny)" : ""}
          </div>
          {hasOverride ? (
            <div className="mt-1 flex items-start gap-1 rounded-sm bg-amber-500/15 px-1.5 py-1 text-[11px] text-amber-700 dark:text-amber-300">
              <Pin
                className="mt-0.5 size-2.5 shrink-0"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <span className="font-medium">Admin override</span>
                {override?.note ? (
                  <span className="block truncate">{override.note}</span>
                ) : null}
              </div>
            </div>
          ) : null}
          {loading ? (
            <div className="mt-1 text-[11px] text-muted-foreground">
              Loading…
            </div>
          ) : hasData ? (
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

function PaletteSwatch({
  palette,
  muted,
}: {
  palette: ColorPalette | null;
  muted?: boolean;
}) {
  const colors = paletteSwatchColors(palette);
  // Reserve space while loading so the top row layout is stable.
  if (colors.length === 0) {
    return (
      <span
        className="inline-block h-3 w-7 rounded-sm bg-muted/60 ring-1 ring-background/70"
        aria-hidden="true"
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={`Palette: ${colors.join(", ")}`}
      title={colors.map((c) => c.toUpperCase()).join(" · ")}
      className={cn(
        "inline-flex h-3 overflow-hidden rounded-sm ring-1 ring-background/70 shadow-sm",
        muted && "opacity-70",
      )}
    >
      {colors.map((hex, i) => (
        <span
          key={`${hex}-${i}`}
          className="block h-full"
          style={{ width: 8, backgroundColor: hex }}
        />
      ))}
    </span>
  );
}

function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-1 text-[11px] text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="inline-flex items-center gap-1">
          <Users className="size-3" aria-hidden="true" />
          Plays
        </span>
        <span className="inline-flex items-center gap-1">
          <Trophy className="size-3" aria-hidden="true" />
          Win rate
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className="inline-flex size-3.5 items-center justify-center rounded-full bg-amber-500 text-amber-50"
            aria-hidden="true"
          >
            <Pin className="size-2" aria-hidden="true" />
          </span>
          Override
        </span>
      </div>
      <Link href="/admin/game?view=daily" className="hover:underline">
        View daily table →
      </Link>
    </div>
  );
}
