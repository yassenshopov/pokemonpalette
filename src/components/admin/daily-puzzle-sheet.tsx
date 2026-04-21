"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  HelpCircle,
  Lightbulb,
  Search,
  Sparkles,
  Target,
  Trophy,
  User as UserIcon,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatAbsolute } from "@/lib/admin/format";
import { RelativeTime } from "@/components/admin/relative-time";
import type { ColorPalette } from "@/types/pokemon";

interface DailyPuzzleSheetProps {
  /** ISO date (YYYY-MM-DD) to show, or null when closed. */
  date: string | null;
  onOpenChange: (open: boolean) => void;
}

interface PokemonSummary {
  id: number;
  name: string;
  type: string[];
  generation: number;
  rarity: string;
  colorPalette: ColorPalette;
  shinyColorPalette: ColorPalette | null;
}

interface RecentAttempt {
  id: string;
  user_id: string;
  attempts: number;
  won: boolean;
  hints_used: number;
  is_shiny: boolean;
  pokemon_guessed: number | null;
  created_at: string;
  user: {
    id: string;
    email: string | null;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    profile_image_url: string | null;
  } | null;
}

interface DailyPuzzleResponse {
  date: string;
  game_number: number;
  target_pokemon_id: number;
  pokemon: PokemonSummary | null;
  pokemon_by_id: Record<string, PokemonSummary>;
  kpis: {
    attempts: number;
    unique_players: number;
    wins: number;
    losses: number;
    shiny_attempts: number;
    avg_attempts: number;
    avg_attempts_win: number;
    avg_hints: number;
    first_solved_at: string | null;
    fastest_attempts: number | null;
    first_play_at: string | null;
    last_play_at: string | null;
    target_pokemon_id: number;
    win_rate: number;
  };
  attempts_histogram: Array<{ bucket: number; count: number; wins: number }>;
  hints_histogram: Array<{ bucket: number; count: number }>;
  top_wrong_guesses: Array<{ pokemon_id: number; count: number }>;
  recent: RecentAttempt[];
}

function officialArtworkUrl(pokemonId: number, shiny = false) {
  const suffix = shiny ? "/shiny" : "";
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork${suffix}/${pokemonId}.png`;
}

function fullDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function compareToToday(iso: string): "past" | "today" | "future" {
  const today = new Date();
  const todayIso = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10);
  if (iso === todayIso) return "today";
  return iso < todayIso ? "past" : "future";
}

function playerLabel(u: RecentAttempt["user"]): string {
  if (!u) return "Unknown";
  const name = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
  return name || u.username || u.email || u.id;
}

function playerInitials(u: RecentAttempt["user"]): string {
  if (!u) return "??";
  const base =
    `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() ||
    u.username ||
    u.email ||
    "";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return (base.slice(0, 2) || "??").toUpperCase();
}

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Couldn’t copy ${label}`);
  }
}

export function DailyPuzzleSheet({
  date,
  onOpenChange,
}: DailyPuzzleSheetProps) {
  const [data, setData] = React.useState<DailyPuzzleResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!date) {
      setData(null);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/admin/game-data/daily/${date}`, {
      signal: ctrl.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error ?? `Failed (${res.status})`);
        }
        return (await res.json()) as DailyPuzzleResponse;
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message || "Failed to load.");
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [date]);

  return (
    <Sheet open={Boolean(date)} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          // Wider than the default 24rem; comfortable for charts + mock.
          "w-full gap-0 p-0 sm:max-w-xl lg:max-w-2xl",
          // Prevent page-scroll chaining into the sheet on iOS.
          "overscroll-contain",
        )}
      >
        {date ? (
          <>
            <SheetHeaderBlock
              date={date}
              data={data}
              loading={loading && !data}
            />
            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-5 px-5 pb-8 pt-2">
                {error ? (
                  <Card role="alert">
                    <CardContent className="py-4 text-sm text-destructive">
                      {error}
                    </CardContent>
                  </Card>
                ) : loading && !data ? (
                  <LoadingState />
                ) : data ? (
                  <DailyPuzzleBody data={data} />
                ) : null}
              </div>
            </ScrollArea>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

// --------------------------------------------------------------------------
// Header
// --------------------------------------------------------------------------

function SheetHeaderBlock({
  date,
  data,
  loading,
}: {
  date: string;
  data: DailyPuzzleResponse | null;
  loading: boolean;
}) {
  const when = compareToToday(date);
  const dateLabel = fullDateLabel(date);

  return (
    <SheetHeader className="gap-2 border-b px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <SheetTitle className="text-lg leading-tight">
            <span className="text-pretty">{dateLabel}</span>
          </SheetTitle>
          {/* Render the description as a div — the Skeleton and Separator
              below are block elements, which aren't valid inside the
              default `<p>` that Radix's Description uses. */}
          <SheetDescription asChild>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {data ? (
                <span className="font-mono tabular-nums" translate="no">
                  Game #{data.game_number}
                </span>
              ) : loading ? (
                <Skeleton className="h-3 w-16" />
              ) : null}
              <Separator orientation="vertical" className="h-3" />
              <span className="font-mono tabular-nums" translate="no">
                {date}
              </span>
            </div>
          </SheetDescription>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pr-7">
          {when === "today" ? (
            <Badge variant="default" className="gap-1">
              <Clock className="size-3" aria-hidden="true" />
              Today
            </Badge>
          ) : when === "future" ? (
            <Badge variant="outline" className="gap-1">
              <Clock className="size-3" aria-hidden="true" />
              Upcoming
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <Clock className="size-3" aria-hidden="true" />
              Past
            </Badge>
          )}
          {data && data.kpis.shiny_attempts > 0 ? (
            <Badge variant="outline" className="gap-1">
              <Sparkles className="size-3" aria-hidden="true" />
              Shiny plays
            </Badge>
          ) : null}
        </div>
      </div>
    </SheetHeader>
  );
}

// --------------------------------------------------------------------------
// Body
// --------------------------------------------------------------------------

function DailyPuzzleBody({ data }: { data: DailyPuzzleResponse }) {
  const hasPlays = data.kpis.attempts > 0;
  const when = compareToToday(data.date);

  return (
    <>
      <PlayerMockCard data={data} />
      {hasPlays ? (
        <>
          <KpiGrid data={data} />
          <AttemptsHistogramCard data={data} />
          <TopGuessesCard data={data} />
          <RecentAttemptsCard data={data} />
        </>
      ) : (
        <EmptyPuzzleState when={when} />
      )}
      <ActionsFooter data={data} />
    </>
  );
}

// --------------------------------------------------------------------------
// "As players saw it" — mock
// --------------------------------------------------------------------------

function PlayerMockCard({ data }: { data: DailyPuzzleResponse }) {
  const [shiny, setShiny] = React.useState(false);
  const [revealed, setRevealed] = React.useState(false);
  const p = data.pokemon;

  const activePalette = React.useMemo<ColorPalette | null>(() => {
    if (!p) return null;
    if (shiny && p.shinyColorPalette) return p.shinyColorPalette;
    return p.colorPalette;
  }, [p, shiny]);

  const swatches = React.useMemo<string[]>(() => {
    if (!activePalette) return [];
    // Use primary / secondary / accent, then the unique highlights (up to 6 total).
    const ordered = [
      activePalette.primary,
      activePalette.secondary,
      activePalette.accent,
      ...activePalette.highlights,
    ].filter(Boolean);
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const h of ordered) {
      const v = (h ?? "").toLowerCase();
      if (!v || seen.has(v)) continue;
      seen.add(v);
      unique.push(h);
    }
    return unique.slice(0, 6);
  }, [activePalette]);

  const bgPrimary = activePalette?.primary ?? "#e5e7eb";

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <Target className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            As players saw it
          </h3>
        </div>
        <div className="flex items-center gap-1">
          {p?.shinyColorPalette ? (
            <Button
              type="button"
              size="sm"
              variant={shiny ? "default" : "outline"}
              className="h-7 gap-1 px-2 text-[11px]"
              onClick={() => setShiny((s) => !s)}
              aria-pressed={shiny}
            >
              <Sparkles className="size-3" aria-hidden="true" />
              Shiny
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
            onClick={() => setRevealed((r) => !r)}
            aria-pressed={revealed}
          >
            {revealed ? "Hide answer" : "Reveal answer"}
          </Button>
        </div>
      </div>

      <div
        className="relative isolate grid grid-cols-[auto,1fr] gap-4 p-4"
        style={{
          background: `linear-gradient(135deg, ${withAlpha(bgPrimary, 0.18)}, transparent 70%)`,
        }}
      >
        {/* Silhouette / reveal */}
        <div className="relative size-36 shrink-0 overflow-hidden rounded-lg bg-muted/30 shadow-inner">
          {p ? (
            <Image
              src={officialArtworkUrl(p.id, shiny)}
              alt={revealed ? `${p.name} artwork` : ""}
              aria-hidden={revealed ? undefined : "true"}
              fill
              sizes="144px"
              className={cn(
                "object-contain transition-all duration-300",
                !revealed && "brightness-0 dark:invert opacity-70",
              )}
              unoptimized
            />
          ) : (
            <Skeleton className="size-full" />
          )}
          <span
            className="pointer-events-none absolute bottom-1 left-1 rounded bg-background/80 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-foreground backdrop-blur-sm"
            translate="no"
          >
            #{(p?.id ?? 0).toString().padStart(4, "0")}
          </span>
        </div>

        {/* Palette */}
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Color palette
          </p>
          <div className="flex flex-wrap gap-1.5">
            {swatches.length === 0
              ? Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="size-10 rounded-md" />
                ))
              : swatches.map((hex, i) => (
                  <Swatch key={`${hex}-${i}`} hex={hex} />
                ))}
          </div>

          {/* Mock search bar — matches the game's text input visually. */}
          <div className="mt-1 flex h-9 items-center gap-2 rounded-md border bg-background/80 px-2.5 text-xs text-muted-foreground shadow-sm">
            <Search className="size-3.5" aria-hidden="true" />
            <span className="truncate">Type a Pokémon name…</span>
            <span className="ml-auto rounded border bg-muted px-1.5 font-mono text-[10px]">
              Enter
            </span>
          </div>
        </div>
      </div>

      {/* Revealed Pokémon details strip. */}
      {p ? (
        <div className="flex flex-wrap items-center gap-2 border-t bg-muted/30 px-4 py-2 text-xs">
          <span className="font-medium" translate="no">
            {revealed ? p.name : "???"}
          </span>
          {revealed ? (
            <>
              {p.type.map((t) => (
                <Badge key={t} variant="secondary" className="h-5 text-[10px]">
                  {t}
                </Badge>
              ))}
              <span className="text-muted-foreground">
                Gen {p.generation} · {p.rarity}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">
              Click “Reveal answer” to show
            </span>
          )}
        </div>
      ) : null}
    </Card>
  );
}

function Swatch({ hex }: { hex: string }) {
  const label = hex.toUpperCase();
  return (
    <button
      type="button"
      onClick={() => copy(label, "Hex")}
      className="group relative flex flex-col items-center gap-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      aria-label={`Copy hex ${label}`}
    >
      <span
        className="size-10 rounded-md border shadow-sm transition-transform group-hover:scale-105"
        style={{ backgroundColor: hex }}
        aria-hidden="true"
      />
      <span
        className="font-mono text-[10px] tabular-nums text-muted-foreground"
        translate="no"
      >
        {label}
      </span>
      <Copy
        className="absolute right-0 top-0 size-2.5 opacity-0 transition-opacity group-hover:opacity-60"
        aria-hidden="true"
      />
    </button>
  );
}

// --------------------------------------------------------------------------
// KPIs
// --------------------------------------------------------------------------

function KpiGrid({ data }: { data: DailyPuzzleResponse }) {
  const k = data.kpis;
  const items: Array<{
    label: string;
    value: string;
    hint?: string;
    icon: React.ReactNode;
    tone?: "default" | "positive" | "negative";
  }> = [
    {
      label: "Attempts",
      value: k.attempts.toLocaleString(),
      icon: <Target className="size-3.5" aria-hidden="true" />,
    },
    {
      label: "Unique players",
      value: k.unique_players.toLocaleString(),
      icon: <UserIcon className="size-3.5" aria-hidden="true" />,
    },
    {
      label: "Win rate",
      value: k.attempts > 0 ? `${(k.win_rate * 100).toFixed(1)}%` : "—",
      hint: k.attempts > 0 ? `${k.wins} win${k.wins === 1 ? "" : "s"}` : undefined,
      icon: <Trophy className="size-3.5" aria-hidden="true" />,
      tone:
        k.attempts === 0
          ? "default"
          : k.win_rate >= 0.66
            ? "positive"
            : k.win_rate < 0.33
              ? "negative"
              : "default",
    },
    {
      label: "Avg guesses",
      value: Number(k.avg_attempts_win || k.avg_attempts || 0).toFixed(2),
      hint: k.avg_attempts_win > 0 ? "winners only" : "all attempts",
      icon: <HelpCircle className="size-3.5" aria-hidden="true" />,
    },
    {
      label: "Avg hints",
      value: Number(k.avg_hints || 0).toFixed(2),
      icon: <Lightbulb className="size-3.5" aria-hidden="true" />,
    },
    {
      label: "First solved",
      value: k.first_solved_at
        ? new Date(k.first_solved_at).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—",
      hint: k.fastest_attempts
        ? `in ${k.fastest_attempts} guess${k.fastest_attempts === 1 ? "" : "es"}`
        : undefined,
      icon: <CheckCircle2 className="size-3.5" aria-hidden="true" />,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-md border bg-card p-3"
          role="group"
          aria-label={item.label}
        >
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {item.icon}
            <span className="truncate">{item.label}</span>
          </div>
          <div
            className={cn(
              "mt-1 text-lg font-semibold tabular-nums",
              item.tone === "positive" &&
                "text-emerald-600 dark:text-emerald-400",
              item.tone === "negative" && "text-rose-600 dark:text-rose-400",
            )}
          >
            {item.value}
          </div>
          {item.hint ? (
            <div className="text-[11px] text-muted-foreground">{item.hint}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// --------------------------------------------------------------------------
// Attempts histogram
// --------------------------------------------------------------------------

function AttemptsHistogramCard({ data }: { data: DailyPuzzleResponse }) {
  // Normalize to buckets 1..7 so every day has the same x-axis.
  const raw = new Map<number, { count: number; wins: number }>();
  for (const row of data.attempts_histogram) {
    raw.set(row.bucket, { count: row.count, wins: row.wins });
  }
  const buckets = Array.from({ length: 7 }, (_, i) => {
    const b = i + 1;
    const r = raw.get(b) ?? { count: 0, wins: 0 };
    return { bucket: b, ...r };
  });
  const max = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Attempts to solve</h3>
          <span className="text-[11px] text-muted-foreground">
            Wins vs. losses per guess count
          </span>
        </div>
        <div className="flex items-end gap-1.5">
          {buckets.map((b) => {
            const total = b.count;
            const losses = Math.max(0, total - b.wins);
            const winH = max > 0 ? (b.wins / max) * 100 : 0;
            const lossH = max > 0 ? (losses / max) * 100 : 0;
            const empty = total === 0;
            return (
              <div
                key={b.bucket}
                className="flex min-w-0 flex-1 flex-col items-center gap-1"
                aria-label={`${b.bucket === 7 ? "7+" : b.bucket} guesses: ${total}`}
              >
                <div className="relative flex h-24 w-full items-end overflow-hidden rounded-sm border bg-muted/30">
                  {empty ? null : (
                    <div className="flex size-full flex-col justify-end">
                      <div
                        className="w-full bg-rose-500/70 transition-[height]"
                        style={{ height: `${lossH}%` }}
                        aria-hidden="true"
                      />
                      <div
                        className="w-full bg-emerald-500/80 transition-[height]"
                        style={{ height: `${winH}%` }}
                        aria-hidden="true"
                      />
                    </div>
                  )}
                  {!empty ? (
                    <span className="absolute left-1/2 top-1 -translate-x-1/2 rounded bg-background/80 px-1 text-[10px] font-medium tabular-nums backdrop-blur-sm">
                      {total}
                    </span>
                  ) : null}
                </div>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {b.bucket === 7 ? "7+" : b.bucket}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 pt-1 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span
              className="size-2 rounded-sm bg-emerald-500/80"
              aria-hidden="true"
            />
            Wins
          </span>
          <span className="inline-flex items-center gap-1">
            <span
              className="size-2 rounded-sm bg-rose-500/70"
              aria-hidden="true"
            />
            Losses
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// --------------------------------------------------------------------------
// Top wrong guesses
// --------------------------------------------------------------------------

function TopGuessesCard({ data }: { data: DailyPuzzleResponse }) {
  const rows = data.top_wrong_guesses.slice(0, 10);
  if (rows.length === 0) return null;

  const max = rows[0]?.count ?? 1;
  const totalGuesses = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Most common wrong guesses</h3>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {totalGuesses.toLocaleString()} shown
          </span>
        </div>
        <ul className="space-y-1.5" aria-label="Top wrong guesses">
          {rows.map((g) => {
            const p = data.pokemon_by_id[String(g.pokemon_id)];
            const width = Math.max(6, (g.count / max) * 100);
            return (
              <li key={g.pokemon_id}>
                <Link
                  href={`/admin/game?view=attempts&target_pokemon_id=${g.pokemon_id}`}
                  className="group flex items-center gap-2 rounded-md p-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="relative size-7 shrink-0 overflow-hidden rounded bg-muted">
                    <Image
                      src={officialArtworkUrl(g.pokemon_id)}
                      alt=""
                      fill
                      sizes="28px"
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate font-medium">
                        {p ? p.name : `#${g.pokemon_id}`}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {g.count.toLocaleString()}
                      </span>
                    </div>
                    <div className="relative mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary/60"
                        style={{ width: `${width}%` }}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

// --------------------------------------------------------------------------
// Recent attempts
// --------------------------------------------------------------------------

function RecentAttemptsCard({ data }: { data: DailyPuzzleResponse }) {
  const rows = data.recent;
  if (rows.length === 0) return null;

  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Recent plays</h3>
          <Link
            href={`/admin/game?view=attempts&date_from=${data.date}&date_to=${data.date}`}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
          >
            See all
            <ArrowRight className="size-3" aria-hidden="true" />
          </Link>
        </div>
        <ul className="divide-y" aria-label="Recent attempts">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-2 py-2 first:pt-1 last:pb-0"
            >
              <Avatar className="size-7">
                {r.user?.image_url ? (
                  <AvatarImage
                    src={r.user.image_url}
                    alt=""
                    referrerPolicy="no-referrer"
                  />
                ) : null}
                <AvatarFallback className="text-[10px]">
                  {playerInitials(r.user)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/admin/users/${r.user_id}`}
                    className="min-w-0 truncate text-xs font-medium hover:underline"
                  >
                    {playerLabel(r.user)}
                  </Link>
                  {r.won ? (
                    <Badge
                      variant="default"
                      className="h-4 gap-0.5 px-1 text-[10px]"
                    >
                      <CheckCircle2 className="size-2.5" aria-hidden="true" />
                      Win
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="h-4 gap-0.5 px-1 text-[10px]"
                    >
                      <XCircle className="size-2.5" aria-hidden="true" />
                      Loss
                    </Badge>
                  )}
                  {r.is_shiny ? (
                    <Sparkles
                      className="size-3 text-amber-500"
                      aria-label="Shiny"
                    />
                  ) : null}
                </div>
                <div className="truncate text-[11px] text-muted-foreground tabular-nums">
                  {r.attempts} guess{r.attempts === 1 ? "" : "es"}
                  {r.hints_used > 0
                    ? ` · ${r.hints_used} hint${r.hints_used === 1 ? "" : "s"}`
                    : ""}
                  {" · "}
                  <time
                    dateTime={r.created_at}
                    title={formatAbsolute(r.created_at)}
                  >
                    <RelativeTime value={r.created_at} />
                  </time>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                asChild
                className="size-7 shrink-0"
                aria-label="Open attempt detail"
              >
                <Link href={`/admin/game/${r.id}`}>
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// --------------------------------------------------------------------------
// Empty state & actions
// --------------------------------------------------------------------------

function EmptyPuzzleState({
  when,
}: {
  when: "past" | "today" | "future";
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-5 text-center">
        <Target
          className="mx-auto size-6 text-muted-foreground"
          aria-hidden="true"
        />
        <div className="text-sm font-medium">
          {when === "future"
            ? "Upcoming puzzle"
            : when === "today"
              ? "No plays yet today"
              : "No plays on this day"}
        </div>
        <p className="text-xs text-muted-foreground">
          {when === "future"
            ? "The target shown is the deterministic pick for this date. Stats appear once players start solving."
            : "No one logged an attempt on this date."}
        </p>
      </CardContent>
    </Card>
  );
}

function ActionsFooter({ data }: { data: DailyPuzzleResponse }) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <Button size="sm" variant="outline" asChild>
        <Link
          href={`/admin/game?view=attempts&date_from=${data.date}&date_to=${data.date}`}
        >
          <Target className="mr-1.5 size-4" aria-hidden="true" />
          View all attempts
        </Link>
      </Button>
      <Button size="sm" variant="outline" asChild>
        <Link href={`/admin/game?view=daily`}>
          Daily table
        </Link>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => copy(data.date, "Date")}
      >
        <Copy className="mr-1.5 size-4" aria-hidden="true" />
        Copy date
      </Button>
    </div>
  );
}

// --------------------------------------------------------------------------
// Misc
// --------------------------------------------------------------------------

function LoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-56 rounded-lg" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-md" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-lg" />
      <Skeleton className="h-40 rounded-lg" />
    </div>
  );
}

/** Append an 8-bit alpha suffix (0..1) onto a #rrggbb string. Returns the
 *  input unchanged if it isn't a recognizable hex. */
function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const a = Math.round(
    Math.max(0, Math.min(1, alpha)) * 255,
  )
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}
