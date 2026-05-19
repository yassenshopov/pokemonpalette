"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  BookMarked,
  Calendar,
  Compass,
  Layers,
  RefreshCw,
  Sparkles,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "@/components/admin/kpi-card";
import { RangePicker } from "@/components/admin/range-picker";
import {
  rangeFromSearchParams,
  rangeToSearchParams,
  type RangeValue,
} from "@/lib/admin/range";

// --- types -----------------------------------------------------------------

interface SparkPoint {
  date: string;
  count: number;
}

interface UserMini {
  id: string;
  email: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  profile_image_url: string | null;
}

interface TopCatcher {
  user_id: string;
  catches: number;
  shinies: number;
  species: number;
  user: UserMini | null;
}

interface TopSpecies {
  pokemon_id: number;
  catches: number;
  shiny_catches: number;
}

interface RecentCatch {
  id: string;
  user_id: string;
  pokemon_id: number;
  is_shiny: boolean;
  mode: string;
  attempts: number;
  hints_used: number;
  caught_at: string;
  user: UserMini | null;
}

interface PokedexResponse {
  range: {
    preset: RangeValue["preset"];
    from: string;
    to: string;
    days: number;
    label: string;
  };
  kpis: {
    catches: number;
    catchesPrev: number;
    catchers: number;
    catchersPrev: number;
    species: number;
    speciesPrev: number;
    shinies: number;
    shiniesPrev: number;
    dailyCatches: number;
    unlimitedCatches: number;
    avgAttempts: number;
    avgHints: number;
  };
  totals: {
    catches: number;
    catchers: number;
    species: number;
    shinies: number;
  };
  series: {
    catches: SparkPoint[];
    shinies: SparkPoint[];
    daily: SparkPoint[];
    unlimited: SparkPoint[];
  };
  leaderboards: {
    topCatchers: TopCatcher[];
    topSpecies: TopSpecies[];
  };
  recent: RecentCatch[];
  generatedAt: string;
}

// --- helpers ---------------------------------------------------------------

const numberFormatter = new Intl.NumberFormat("en-US");
const dateShort = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const dateLong = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const relativeFormatter = new Intl.RelativeTimeFormat("en-US", {
  numeric: "auto",
});

function formatRelative(iso: string | undefined | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((then - now) / 1000);
  if (Math.abs(diffSec) < 60) return relativeFormatter.format(diffSec, "second");
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return relativeFormatter.format(diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return relativeFormatter.format(diffHour, "hour");
  const diffDay = Math.round(diffHour / 24);
  return relativeFormatter.format(diffDay, "day");
}

function displayName(user: UserMini | null | undefined): string {
  if (!user) return "Unknown";
  const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  if (name) return name;
  if (user.username) return user.username;
  if (user.email) return user.email.split("@")[0] ?? "User";
  return "User";
}

function initials(user: UserMini | null | undefined): string {
  if (!user) return "?";
  if (user.first_name || user.last_name) {
    return (
      `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() ||
      "U"
    );
  }
  if (user.username) return user.username.slice(0, 2).toUpperCase();
  if (user.email) return user.email.slice(0, 2).toUpperCase();
  return "U";
}

function officialArtworkUrl(pokemonId: number, shiny = false) {
  const suffix = shiny ? "/shiny" : "";
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork${suffix}/${pokemonId}.png`;
}

function paddedDexNumber(id: number) {
  return `#${id.toString().padStart(4, "0")}`;
}

// --- component -------------------------------------------------------------

type SeriesTab = "catches" | "shinies" | "daily" | "unlimited";

const SERIES_TABS: Array<{
  id: SeriesTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = [
  {
    id: "catches",
    label: "All catches",
    icon: BookMarked,
    description: "Every Pokédex entry recorded in range",
  },
  {
    id: "shinies",
    label: "Shinies",
    icon: Sparkles,
    description: "Shiny variants caught in range",
  },
  {
    id: "daily",
    label: "Daily mode",
    icon: Calendar,
    description: "Catches earned from daily puzzles",
  },
  {
    id: "unlimited",
    label: "Unlimited",
    icon: Compass,
    description: "Catches earned from unlimited play",
  },
];

export function AdminPokedex() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialRange = React.useMemo(
    () => rangeFromSearchParams(searchParams),
    [searchParams],
  );
  const [range, setRange] = React.useState<RangeValue>(initialRange);

  React.useEffect(() => {
    setRange(rangeFromSearchParams(searchParams));
  }, [searchParams]);

  const [data, setData] = React.useState<PokedexResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [seriesTab, setSeriesTab] = React.useState<SeriesTab>("catches");

  const queryString = React.useMemo(() => {
    const params = new URLSearchParams();
    if (range.preset === "custom") {
      params.set("from", range.from);
      params.set("to", range.to);
    } else if (range.preset !== "30d") {
      params.set("range", range.preset);
    }
    return params.toString();
  }, [range]);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const url = `/api/admin/pokedex${queryString ? `?${queryString}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 403) throw new Error("Access denied.");
        if (res.status === 401) throw new Error("Please sign in.");
        throw new Error("Failed to load Pokédex data.");
      }
      const json = (await res.json()) as PokedexResponse;
      setData(json);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load Pokédex.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [queryString]);

  React.useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const handleRangeChange = (next: RangeValue) => {
    setRange(next);
    const nextParams = rangeToSearchParams(
      new URLSearchParams(searchParams?.toString() ?? ""),
      next,
    );
    const qs = nextParams.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const kpis = data?.kpis;
  const totals = data?.totals;
  const series = data?.series;
  const leaderboards = data?.leaderboards;
  const recent = data?.recent;
  const rangeLabel = data?.range.label ?? "";
  const deltaLabel = data?.range
    ? `vs previous ${data.range.days}d`
    : "vs previous period";

  const modeSplit = React.useMemo(() => {
    if (!kpis) return null;
    const total = kpis.dailyCatches + kpis.unlimitedCatches;
    if (total === 0) return null;
    return {
      dailyPct: (kpis.dailyCatches / total) * 100,
      unlimitedPct: (kpis.unlimitedCatches / total) * 100,
    };
  }, [kpis]);

  const shinyPct = React.useMemo(() => {
    if (!kpis || kpis.catches === 0) return 0;
    return (kpis.shinies / kpis.catches) * 100;
  }, [kpis]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RangePicker
          value={range}
          onChange={handleRangeChange}
          disabled={refreshing}
        />
        <div className="flex items-center gap-3">
          <div
            className="text-xs text-muted-foreground"
            aria-live="polite"
            suppressHydrationWarning
          >
            {loading
              ? "Loading Pokédex metrics…"
              : data
                ? `Updated ${formatRelative(data.generatedAt)}`
                : ""}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh Pokédex metrics"
          >
            <RefreshCw
              className={refreshing ? "animate-spin" : undefined}
              aria-hidden="true"
            />
            <span>{refreshing ? "Refreshing…" : "Refresh"}</span>
          </Button>
        </div>
      </div>

      {error ? (
        <Card role="alert" aria-live="polite">
          <CardHeader>
            <CardTitle className="text-destructive">
              Could not load Pokédex data
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {/* All-time totals banner */}
      <section aria-label="All-time Pokédex totals">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"
              >
                <BookMarked className="size-4" />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  All-time
                </p>
                <p className="text-sm">
                  Lifetime catches across every player
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
              <Stat
                label="Catches"
                value={totals?.catches}
                loading={loading}
              />
              <Stat
                label="Catchers"
                value={totals?.catchers}
                loading={loading}
              />
              <Stat
                label="Species"
                value={totals?.species}
                loading={loading}
              />
              <Stat
                label="Shinies"
                value={totals?.shinies}
                loading={loading}
              />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Range KPIs */}
      <section
        aria-label={`Range KPIs — ${rangeLabel}`}
        className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
      >
        <KpiCard
          label="Catches"
          value={kpis?.catches ?? 0}
          previous={kpis?.catchesPrev}
          deltaLabel={deltaLabel}
          loading={loading}
          series={series?.catches}
          icon={<BookMarked />}
        />
        <KpiCard
          label="Catchers"
          value={kpis?.catchers ?? 0}
          previous={kpis?.catchersPrev}
          deltaLabel={deltaLabel}
          loading={loading}
          icon={<Users />}
          hint="Distinct players who caught at least one Pokémon"
        />
        <KpiCard
          label="Species"
          value={kpis?.species ?? 0}
          previous={kpis?.speciesPrev}
          deltaLabel={deltaLabel}
          loading={loading}
          icon={<Layers />}
          hint="Unique Pokémon caught in range"
        />
        <KpiCard
          label="Shinies"
          value={kpis?.shinies ?? 0}
          previous={kpis?.shiniesPrev}
          deltaLabel={deltaLabel}
          loading={loading}
          series={series?.shinies}
          icon={<Sparkles />}
          hint={
            kpis && kpis.catches > 0
              ? `${shinyPct.toFixed(1)}% of catches were shiny`
              : "No catches yet"
          }
        />
        <KpiCard
          label="Avg attempts"
          value={kpis ? Number(kpis.avgAttempts.toFixed(2)) : 0}
          loading={loading}
          icon={<Target />}
          hint="Guesses needed per catch (lower is better)"
        />
        <KpiCard
          label="Avg hints"
          value={kpis ? Number(kpis.avgHints.toFixed(2)) : 0}
          loading={loading}
          icon={<Activity />}
          hint="Hints used per catch (lower is better)"
        />
      </section>

      {/* Series chart */}
      <section aria-label="Catches trend">
        <Card className="gap-3">
          <CardHeader className="gap-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookMarked className="size-4" aria-hidden="true" />
                  Catches over {rangeLabel.toLowerCase()}
                </CardTitle>
                <CardDescription>
                  {SERIES_TABS.find((t) => t.id === seriesTab)?.description}
                </CardDescription>
              </div>
              <Tabs
                value={seriesTab}
                onValueChange={(v) => setSeriesTab(v as SeriesTab)}
              >
                <TabsList className="h-8">
                  {SERIES_TABS.map((tab) => (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="gap-1 px-2.5 text-xs"
                    >
                      <tab.icon className="size-3.5" />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <CatchAreaChart
                key={seriesTab}
                data={series?.[seriesTab] ?? []}
                label={SERIES_TABS.find((t) => t.id === seriesTab)?.label ?? ""}
              />
            )}
          </CardContent>
        </Card>
      </section>

      {/* Mode split */}
      {modeSplit ? (
        <section aria-label="Catch source split">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Where catches came from</CardTitle>
              <CardDescription>
                How the {numberFormatter.format(kpis?.catches ?? 0)} catches in
                this range broke down by game mode.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SplitBar
                left={{
                  label: "Daily",
                  value: kpis?.dailyCatches ?? 0,
                  pct: modeSplit.dailyPct,
                  icon: Calendar,
                  tone: "primary",
                }}
                right={{
                  label: "Unlimited",
                  value: kpis?.unlimitedCatches ?? 0,
                  pct: modeSplit.unlimitedPct,
                  icon: Compass,
                  tone: "emerald",
                }}
              />
            </CardContent>
          </Card>
        </section>
      ) : null}

      {/* Leaderboards */}
      <section
        aria-label="Pokédex leaderboards"
        className="grid grid-cols-1 gap-4 xl:grid-cols-3"
      >
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4" aria-hidden="true" />
              Top Catchers
            </CardTitle>
            <CardDescription>Most Pokémon caught in range.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ListSkeleton />
            ) : leaderboards && leaderboards.topCatchers.length > 0 ? (
              <ol className="space-y-2" role="list">
                {leaderboards.topCatchers.map((c, idx) => (
                  <li key={c.user_id}>
                    <Link
                      href={`/admin/users/${c.user_id}`}
                      className="group flex items-center gap-3 rounded-md p-2 -mx-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="w-4 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                        {idx + 1}
                      </span>
                      <Avatar className="size-8">
                        <AvatarImage
                          src={
                            c.user?.image_url ??
                            c.user?.profile_image_url ??
                            undefined
                          }
                          alt=""
                        />
                        <AvatarFallback className="text-xs">
                          {initials(c.user)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {displayName(c.user)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground tabular-nums">
                          {numberFormatter.format(c.species)} species
                          {c.shinies > 0
                            ? ` · ${numberFormatter.format(c.shinies)} shiny`
                            : ""}
                        </p>
                      </div>
                      <Badge variant="secondary" className="tabular-nums">
                        {numberFormatter.format(c.catches)}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState message="No catches in this range." />
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="size-4" aria-hidden="true" />
              Most-Caught Pokémon
            </CardTitle>
            <CardDescription>
              Top species earning Pokédex entries in range. A purple ring marks
              species with at least one shiny catch.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <SpeciesGridSkeleton />
            ) : leaderboards && leaderboards.topSpecies.length > 0 ? (
              <ul
                className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8"
                role="list"
              >
                {leaderboards.topSpecies.map((s) => (
                  <li key={s.pokemon_id}>
                    <Link
                      href={`/admin/palettes?pokemon_id=${s.pokemon_id}`}
                      className="group flex flex-col items-center gap-1 rounded-md border bg-card p-2 transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`${paddedDexNumber(s.pokemon_id)} — ${s.catches} catches`}
                    >
                      <div
                        className={
                          s.shiny_catches > 0
                            ? "relative size-12 overflow-hidden rounded-md bg-muted ring-2 ring-violet-500/60"
                            : "relative size-12 overflow-hidden rounded-md bg-muted"
                        }
                      >
                        <Image
                          src={officialArtworkUrl(s.pokemon_id)}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                      <p className="text-[11px] font-mono font-medium tabular-nums">
                        {paddedDexNumber(s.pokemon_id)}
                      </p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">
                        {numberFormatter.format(s.catches)} catch
                        {s.catches === 1 ? "" : "es"}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState message="No species caught in this range." />
            )}
          </CardContent>
        </Card>
      </section>

      {/* Recent catches feed */}
      <section aria-label="Recent catches">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4" aria-hidden="true" />
              Recent Catches
            </CardTitle>
            <CardDescription>
              The latest Pokédex entries logged across all players.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <RecentSkeleton />
            ) : recent && recent.length > 0 ? (
              <ul className="divide-y" role="list">
                {recent.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="relative size-9 shrink-0 overflow-hidden rounded-md bg-muted">
                      <Image
                        src={officialArtworkUrl(c.pokemon_id, c.is_shiny)}
                        alt=""
                        fill
                        sizes="36px"
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/users/${c.user_id}`}
                        className="flex items-center gap-1.5 truncate text-sm font-medium hover:underline"
                      >
                        <Avatar className="size-5 shrink-0">
                          <AvatarImage
                            src={
                              c.user?.image_url ??
                              c.user?.profile_image_url ??
                              undefined
                            }
                            alt=""
                          />
                          <AvatarFallback className="text-[9px]">
                            {initials(c.user)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{displayName(c.user)}</span>
                      </Link>
                      <p className="truncate text-xs text-muted-foreground tabular-nums">
                        caught {paddedDexNumber(c.pokemon_id)}
                        {c.is_shiny ? " ✦ shiny" : ""} · {c.attempts} attempt
                        {c.attempts === 1 ? "" : "s"}
                        {c.hints_used > 0 ? ` · ${c.hints_used} hint${c.hints_used === 1 ? "" : "s"}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge
                        variant={c.mode === "daily" ? "default" : "secondary"}
                        className="capitalize"
                      >
                        {c.mode}
                      </Badge>
                      <span
                        className="text-xs text-muted-foreground tabular-nums"
                        title={dateLong.format(new Date(c.caught_at))}
                        suppressHydrationWarning
                      >
                        {formatRelative(c.caught_at)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState message="No catches recorded yet." />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

// --- charts & subcomponents ------------------------------------------------

function CatchAreaChart({
  data,
  label,
}: {
  data: SparkPoint[];
  label: string;
}) {
  const id = React.useId().replace(/[:]/g, "");
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const total = data.reduce((acc, d) => acc + d.count, 0);

  if (total === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        No {label.toLowerCase()} recorded in this range.
      </div>
    );
  }

  return (
    <div className="h-[260px] w-full text-primary">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 8, bottom: 0, left: -16 }}
        >
          <defs>
            <linearGradient id={`catchArea-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.35} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            strokeDasharray="3 3"
            stroke="currentColor"
            strokeOpacity={0.08}
          />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: string) => {
              const d = new Date(`${v}T00:00:00Z`);
              return Number.isNaN(d.getTime()) ? v : dateShort.format(d);
            }}
            minTickGap={24}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={36}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ stroke: "currentColor", strokeOpacity: 0.2 }}
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
              padding: "6px 10px",
            }}
            labelFormatter={(v: string) => {
              const d = new Date(`${v}T00:00:00Z`);
              return Number.isNaN(d.getTime()) ? v : dateLong.format(d);
            }}
            formatter={(v: number) => [numberFormatter.format(v), label]}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="currentColor"
            strokeWidth={2}
            fill={`url(#catchArea-${id})`}
            isAnimationActive={!reducedMotion}
            animationDuration={400}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function SplitBar({
  left,
  right,
}: {
  left: SplitSegment;
  right: SplitSegment;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 text-sm">
        <SplitLabel segment={left} />
        <SplitLabel segment={right} align="right" />
      </div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${left.label} ${left.pct.toFixed(0)}%, ${right.label} ${right.pct.toFixed(0)}%`}
      >
        <span
          className={
            left.tone === "primary"
              ? "block h-full bg-primary"
              : "block h-full bg-emerald-500"
          }
          style={{ width: `${left.pct}%` }}
        />
        <span
          className={
            right.tone === "primary"
              ? "block h-full bg-primary"
              : "block h-full bg-emerald-500"
          }
          style={{ width: `${right.pct}%` }}
        />
      </div>
    </div>
  );
}

interface SplitSegment {
  label: string;
  value: number;
  pct: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "emerald";
}

function SplitLabel({
  segment,
  align,
}: {
  segment: SplitSegment;
  align?: "left" | "right";
}) {
  const Icon = segment.icon;
  return (
    <div
      className={
        align === "right"
          ? "flex items-center gap-2 text-right"
          : "flex items-center gap-2"
      }
    >
      <span
        aria-hidden="true"
        className={
          segment.tone === "primary"
            ? "inline-flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary"
            : "inline-flex size-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        }
      >
        <Icon className="size-3.5" />
      </span>
      <div>
        <p className="text-sm font-medium">{segment.label}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {numberFormatter.format(segment.value)} ·{" "}
          {segment.pct.toFixed(segment.pct < 10 ? 1 : 0)}%
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  loading,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-lg font-semibold tabular-nums">
        {loading ? (
          <Skeleton className="inline-block h-5 w-12 align-middle" />
        ) : (
          numberFormatter.format(value ?? 0)
        )}
      </span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center rounded-md border border-dashed py-6 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function ListSkeleton() {
  return (
    <ul className="space-y-2" role="list" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 py-1.5">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-5 w-10 rounded-md" />
        </li>
      ))}
    </ul>
  );
}

function SpeciesGridSkeleton() {
  return (
    <ul
      className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8"
      aria-hidden="true"
    >
      {Array.from({ length: 16 }).map((_, i) => (
        <li
          key={i}
          className="flex flex-col items-center gap-1 rounded-md border bg-card p-2"
        >
          <Skeleton className="size-12 rounded-md" />
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-2.5 w-14" />
        </li>
      ))}
    </ul>
  );
}

function RecentSkeleton() {
  return (
    <ul className="divide-y" role="list" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 py-2.5">
          <Skeleton className="size-9 rounded-md" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-5 w-14 rounded-md" />
        </li>
      ))}
    </ul>
  );
}
