"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  BarChart3,
  Gamepad2,
  Mail,
  Palette,
  Paintbrush,
  RefreshCw,
  Sparkles,
  Target,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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

interface OverviewUser {
  id: string;
  email: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  profile_image_url: string | null;
  created_at?: string;
}

interface RecentAttempt {
  id: string;
  user_id: string;
  target_pokemon_id: number;
  is_shiny: boolean;
  attempts: number;
  won: boolean;
  created_at: string;
  user?: OverviewUser | null;
}

interface TopPlayer {
  user_id: string;
  attempts: number;
  wins: number;
  user: OverviewUser | null;
}

interface TopTarget {
  target_pokemon_id: number;
  count: number;
  wins: number;
}

interface TopPalettePokemon {
  pokemon_id: number;
  pokemon_name: string | null;
  count: number;
}

interface OverviewResponse {
  range: {
    preset: RangeValue["preset"];
    from: string;
    to: string;
    days: number;
    label: string;
  };
  kpis: {
    totalUsers: number;
    newSignups: number;
    newSignupsPrev: number;
    activeUsers: number;
    activeUsersPrev: number;
    attempts: number;
    attemptsPrev: number;
    wins: number;
    winsPrev: number;
    winRate: number;
    winRatePrev: number;
    avgAttempts: number;
    avgAttemptsPrev: number;
    uniquePlayers: number;
    palettes: number;
    palettesPrev: number;
  };
  series: {
    signups: SparkPoint[];
    attempts: SparkPoint[];
    wins: SparkPoint[];
    palettes: SparkPoint[];
    active: SparkPoint[];
  };
  leaderboards: {
    topPlayers: TopPlayer[];
    topTargets: TopTarget[];
    topPalettePokemon: TopPalettePokemon[];
  };
  distributions: {
    attempts: Array<{ bucket: number; count: number }>;
    hints: Array<{ bucket: number; count: number }>;
  };
  recent: {
    signups: OverviewUser[];
    attempts: RecentAttempt[];
  };
  generatedAt: string;
}

// --- helpers ---------------------------------------------------------------

const numberFormatter = new Intl.NumberFormat("en-US");
const dateShort = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
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
  const abs = Math.abs(diffSec);
  if (abs < 60) return relativeFormatter.format(diffSec, "second");
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return relativeFormatter.format(diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return relativeFormatter.format(diffHour, "hour");
  const diffDay = Math.round(diffHour / 24);
  return relativeFormatter.format(diffDay, "day");
}

function displayName(user: OverviewUser | null | undefined): string {
  if (!user) return "Unknown";
  const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  if (name) return name;
  if (user.username) return user.username;
  if (user.email) return user.email.split("@")[0];
  return "User";
}

function initials(user: OverviewUser | null | undefined): string {
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

function pokemonName(name: string | null | undefined, id: number) {
  if (name) return name.charAt(0).toUpperCase() + name.slice(1);
  return `#${id}`;
}

const QUICK_ACTIONS = [
  {
    label: "Send Daily Nudge",
    description: "Email opted-in players a reminder.",
    href: "/admin/emails",
    icon: Mail,
  },
  {
    label: "Run Color Extraction",
    description: "Refresh palettes for new Pokémon.",
    href: "/admin/colors",
    icon: Paintbrush,
  },
  {
    label: "Review Game Data",
    description: "Inspect daily attempts & win rates.",
    href: "/admin/game",
    icon: Gamepad2,
  },
];

// --- component -------------------------------------------------------------

type SeriesTab = "attempts" | "wins" | "signups" | "palettes" | "active";

const SERIES_TABS: Array<{
  id: SeriesTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = [
  {
    id: "attempts",
    label: "Attempts",
    icon: Gamepad2,
    description: "Daily game attempts in range",
  },
  {
    id: "wins",
    label: "Wins",
    icon: Trophy,
    description: "Completed daily puzzles in range",
  },
  {
    id: "signups",
    label: "Signups",
    icon: UserPlus,
    description: "New accounts in range",
  },
  {
    id: "palettes",
    label: "Palettes",
    icon: Palette,
    description: "Saved palettes in range",
  },
  {
    id: "active",
    label: "Active players",
    icon: Activity,
    description: "Distinct players per day",
  },
];

export function AdminOverview() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialRange = React.useMemo(
    () => rangeFromSearchParams(searchParams),
    [searchParams],
  );
  const [range, setRange] = React.useState<RangeValue>(initialRange);

  // Sync the picker if the URL changes externally.
  React.useEffect(() => {
    setRange(rangeFromSearchParams(searchParams));
  }, [searchParams]);

  const [data, setData] = React.useState<OverviewResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [seriesTab, setSeriesTab] = React.useState<SeriesTab>("attempts");

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
      const url = `/api/admin/overview${queryString ? `?${queryString}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 403) throw new Error("Access denied.");
        if (res.status === 401) throw new Error("Please sign in.");
        throw new Error("Failed to load overview.");
      }
      const json = (await res.json()) as OverviewResponse;
      setData(json);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load overview.");
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
  const series = data?.series;
  const leaderboards = data?.leaderboards;
  const distributions = data?.distributions;
  const recent = data?.recent;
  const rangeLabel = data?.range.label ?? "";
  const deltaLabel = data?.range
    ? `vs previous ${data.range.days}d`
    : "vs previous period";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RangePicker value={range} onChange={handleRangeChange} disabled={refreshing} />
        <div className="flex items-center gap-3">
          <div
            className="text-xs text-muted-foreground"
            aria-live="polite"
            suppressHydrationWarning
          >
            {loading
              ? "Loading live metrics…"
              : data
                ? `Updated ${formatRelative(data.generatedAt)}`
                : ""}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh overview metrics"
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
              Could not load overview
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {/* KPIs */}
      <section
        aria-label={`Key metrics — ${rangeLabel}`}
        className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
      >
        <KpiCard
          label="Total Users"
          value={kpis?.totalUsers ?? 0}
          loading={loading}
          hint="All-time account total"
          icon={<Users />}
        />
        <KpiCard
          label="New Signups"
          value={kpis?.newSignups ?? 0}
          previous={kpis?.newSignupsPrev}
          deltaLabel={deltaLabel}
          loading={loading}
          series={series?.signups}
          icon={<UserPlus />}
        />
        <KpiCard
          label="Active Players"
          value={kpis?.uniquePlayers ?? 0}
          previous={kpis?.activeUsersPrev}
          deltaLabel={deltaLabel}
          loading={loading}
          series={series?.active}
          icon={<Sparkles />}
        />
        <KpiCard
          label="Attempts"
          value={kpis?.attempts ?? 0}
          previous={kpis?.attemptsPrev}
          deltaLabel={deltaLabel}
          loading={loading}
          series={series?.attempts}
          icon={<Gamepad2 />}
        />
        <KpiCard
          label="Win Rate"
          value={kpis?.winRate ?? 0}
          previous={kpis?.winRatePrev}
          deltaLabel={deltaLabel}
          format="percent"
          loading={loading}
          icon={<Trophy />}
          hint={
            kpis
              ? `${numberFormatter.format(kpis.wins)} wins / ${numberFormatter.format(kpis.attempts)} attempts`
              : undefined
          }
        />
        <KpiCard
          label="Saved Palettes"
          value={kpis?.palettes ?? 0}
          previous={kpis?.palettesPrev}
          deltaLabel={deltaLabel}
          loading={loading}
          series={series?.palettes}
          icon={<Palette />}
        />
      </section>

      {/* Main chart */}
      <section aria-label="Activity trend">
        <Card className="gap-3">
          <CardHeader className="gap-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="size-4" aria-hidden="true" />
                  Activity over {rangeLabel.toLowerCase()}
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
              <MainAreaChart
                key={seriesTab}
                data={series?.[seriesTab] ?? []}
                label={SERIES_TABS.find((t) => t.id === seriesTab)?.label ?? ""}
              />
            )}
          </CardContent>
        </Card>
      </section>

      {/* Leaderboards */}
      <section
        aria-label="Leaderboards"
        className="grid grid-cols-1 gap-4 lg:grid-cols-3"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4" aria-hidden="true" />
              Top Players
            </CardTitle>
            <CardDescription>Most attempts in range.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ListSkeleton />
            ) : leaderboards && leaderboards.topPlayers.length > 0 ? (
              <ol className="space-y-2" role="list">
                {leaderboards.topPlayers.map((p, idx) => {
                  const winRate =
                    p.attempts > 0 ? (p.wins / p.attempts) * 100 : 0;
                  return (
                    <li key={p.user_id}>
                      <Link
                        href={`/admin/users/${p.user_id}`}
                        className="group flex items-center gap-3 rounded-md p-2 -mx-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="w-4 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                          {idx + 1}
                        </span>
                        <Avatar className="size-8">
                          <AvatarImage
                            src={
                              p.user?.image_url ??
                              p.user?.profile_image_url ??
                              undefined
                            }
                            alt=""
                          />
                          <AvatarFallback className="text-xs">
                            {initials(p.user)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {displayName(p.user)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground tabular-nums">
                            {numberFormatter.format(p.attempts)} plays · {winRate.toFixed(0)}% wins
                          </p>
                        </div>
                        <Badge variant="secondary" className="tabular-nums">
                          {numberFormatter.format(p.attempts)}
                        </Badge>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <EmptyState message="No plays in this range." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="size-4" aria-hidden="true" />
              Top Puzzle Targets
            </CardTitle>
            <CardDescription>Most-played Pokémon targets.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ListSkeleton />
            ) : leaderboards && leaderboards.topTargets.length > 0 ? (
              <ol className="space-y-1.5" role="list">
                {leaderboards.topTargets.map((t, idx) => {
                  const winRate = t.count > 0 ? (t.wins / t.count) * 100 : 0;
                  return (
                    <li key={t.target_pokemon_id}>
                      <Link
                        href={`/admin/game?view=attempts&target_pokemon_id=${t.target_pokemon_id}`}
                        className="group flex items-center gap-3 rounded-md p-1.5 -mx-1.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="w-4 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                          {idx + 1}
                        </span>
                        <div className="relative size-9 shrink-0 overflow-hidden rounded bg-muted">
                          <Image
                            src={officialArtworkUrl(t.target_pokemon_id)}
                            alt=""
                            fill
                            sizes="36px"
                            className="object-contain"
                            unoptimized
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium font-mono tabular-nums">
                            #{t.target_pokemon_id.toString().padStart(4, "0")}
                          </p>
                          <p className="truncate text-xs text-muted-foreground tabular-nums">
                            {winRate.toFixed(0)}% wins
                          </p>
                        </div>
                        <Badge variant="secondary" className="tabular-nums">
                          {numberFormatter.format(t.count)}
                        </Badge>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <EmptyState message="No attempts in this range." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="size-4" aria-hidden="true" />
              Top Palette Species
            </CardTitle>
            <CardDescription>Most-saved Pokémon palettes.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ListSkeleton />
            ) : leaderboards &&
              leaderboards.topPalettePokemon.length > 0 ? (
              <ol className="space-y-1.5" role="list">
                {leaderboards.topPalettePokemon.map((p, idx) => (
                  <li key={`${p.pokemon_id}-${p.pokemon_name}`}>
                    <Link
                      href={`/admin/palettes?pokemon_id=${p.pokemon_id}`}
                      className="group flex items-center gap-3 rounded-md p-1.5 -mx-1.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="w-4 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                        {idx + 1}
                      </span>
                      <div className="relative size-9 shrink-0 overflow-hidden rounded bg-muted">
                        <Image
                          src={officialArtworkUrl(p.pokemon_id)}
                          alt=""
                          fill
                          sizes="36px"
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {pokemonName(p.pokemon_name, p.pokemon_id)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground font-mono tabular-nums">
                          #{p.pokemon_id.toString().padStart(4, "0")}
                        </p>
                      </div>
                      <Badge variant="secondary" className="tabular-nums">
                        {numberFormatter.format(p.count)}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState message="No palettes saved in this range." />
            )}
          </CardContent>
        </Card>
      </section>

      {/* Distributions */}
      <section
        aria-label="Distributions"
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <DistributionCard
          title="Attempts to solve"
          description="How many guesses players needed. 7 = gave up / loss."
          data={distributions?.attempts}
          formatter={(b) => (b === 7 ? "7+" : String(b))}
          loading={loading}
        />
        <DistributionCard
          title="Hints used"
          description="How often players fell back on hints. 3 = 3+."
          data={distributions?.hints}
          formatter={(b) => (b === 3 ? "3+" : String(b))}
          loading={loading}
        />
      </section>

      {/* Activity */}
      <section
        aria-label="Recent activity"
        className="grid grid-cols-1 gap-4 xl:grid-cols-3"
      >
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="size-4" aria-hidden="true" />
              Recent Signups
            </CardTitle>
            <CardDescription>Latest accounts to join.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <SignupsSkeleton />
            ) : recent && recent.signups.length > 0 ? (
              <ul className="divide-y" role="list">
                {recent.signups.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <Avatar className="size-9">
                      <AvatarImage
                        src={u.image_url ?? u.profile_image_url ?? undefined}
                        alt=""
                      />
                      <AvatarFallback>{initials(u)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {displayName(u)}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {u.email ?? "No email"}
                      </p>
                    </div>
                    <span
                      className="shrink-0 text-xs text-muted-foreground tabular-nums"
                      suppressHydrationWarning
                    >
                      {formatRelative(u.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState message="No signups yet." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gamepad2 className="size-4" aria-hidden="true" />
              Recent Attempts
            </CardTitle>
            <CardDescription>Latest daily-game plays.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <AttemptsSkeleton />
            ) : recent && recent.attempts.length > 0 ? (
              <ul className="divide-y" role="list">
                {recent.attempts.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/game/${a.id}`}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {displayName(a.user)}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground tabular-nums">
                        #{a.target_pokemon_id} · {a.attempts} attempt
                        {a.attempts === 1 ? "" : "s"}
                        {a.is_shiny ? " · shiny" : ""}
                      </p>
                    </div>
                    <Badge
                      variant={a.won ? "default" : "secondary"}
                      className="shrink-0"
                    >
                      {a.won ? "Won" : "Lost"}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState message="No game attempts yet." />
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-label="Quick Actions">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
            <CardDescription>
              Jump straight into common admin tasks.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group flex items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {action.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {action.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

// --- charts ---------------------------------------------------------------

function MainAreaChart({
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
            <linearGradient id={`mainArea-${id}`} x1="0" y1="0" x2="0" y2="1">
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
              return Number.isNaN(d.getTime())
                ? v
                : d.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  });
            }}
            formatter={(v: number) => [numberFormatter.format(v), label]}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="currentColor"
            strokeWidth={2}
            fill={`url(#mainArea-${id})`}
            isAnimationActive={!reducedMotion}
            animationDuration={400}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function DistributionCard({
  title,
  description,
  data,
  formatter,
  loading,
}: {
  title: string;
  description: string;
  data: Array<{ bucket: number; count: number }> | undefined;
  formatter: (bucket: number) => string;
  loading: boolean;
}) {
  const id = React.useId().replace(/[:]/g, "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[160px] w-full" />
        ) : data && data.length > 0 ? (
          <div className="h-[160px] w-full text-primary">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.map((d) => ({
                  label: formatter(d.bucket),
                  count: d.count,
                }))}
                margin={{ top: 4, right: 8, bottom: 0, left: -16 }}
              >
                <defs>
                  <linearGradient id={`bar-${id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="currentColor" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  strokeOpacity={0.08}
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
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
                  cursor={{ fill: "currentColor", fillOpacity: 0.08 }}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                    padding: "6px 10px",
                  }}
                  formatter={(v: number) => [numberFormatter.format(v), "Count"]}
                />
                <Bar
                  dataKey="count"
                  fill={`url(#bar-${id})`}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState message="No data for this range." />
        )}
      </CardContent>
    </Card>
  );
}

// --- little helpers ---------------------------------------------------------

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
      {Array.from({ length: 5 }).map((_, i) => (
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

function SignupsSkeleton() {
  return (
    <ul className="divide-y" role="list" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 py-2.5">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-3 w-12" />
        </li>
      ))}
    </ul>
  );
}

function AttemptsSkeleton() {
  return (
    <ul className="divide-y" role="list" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 py-2.5">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-5 w-12 rounded-md" />
        </li>
      ))}
    </ul>
  );
}
