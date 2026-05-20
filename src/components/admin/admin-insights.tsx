"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  Flame,
  Gamepad2,
  Map as MapIcon,
  Palette,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { KpiCard } from "@/components/admin/kpi-card";
import { RangePicker } from "@/components/admin/range-picker";
import dynamic from "next/dynamic";

// d3-geo + topojson-client + topojson-specification together add
// ~140 KB to the admin-insights bundle, and the world map sits below
// the fold for most admins. Lazy-loading it via next/dynamic with
// ssr:false keeps the heavy code off the initial admin-insights
// route bundle entirely — Next splits it into its own chunk that
// only downloads when the component mounts client-side.
const AdminInsightsWorldMap = dynamic(
  () =>
    import("@/components/admin/admin-insights-world-map").then((m) => ({
      default: m.AdminInsightsWorldMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-[440px] w-full animate-pulse rounded-lg bg-muted/30"
        aria-label="Loading world map"
      />
    ),
  },
);
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

interface PokedexRow {
  pokemon_id: number;
  pokemon_name: string | null;
  attempts: number;
  wins: number;
  palettes: number;
  score: number;
}

interface InsightsResponse {
  range: {
    preset: RangeValue["preset"];
    from: string;
    to: string;
    days: number;
    label: string;
  };
  kpis: {
    attempts: number;
    attemptsPrev: number;
    wins: number;
    winsPrev: number;
    palettes: number;
    palettesPrev: number;
    uniquePlayers: number;
    uniquePalettists: number;
    pokemonTargeted: number;
    pokemonPalettized: number;
    signups: number;
    signupsPrev: number;
    winRate: number;
    winRatePrev: number;
  };
  totals: {
    attempts: number;
    wins: number;
    palettes: number;
    players: number;
    palettists: number;
    pokemonTargeted: number;
    pokemonPalettized: number;
    users: number;
  };
  series: {
    rangeAttempts: SparkPoint[];
    rangePalettes: SparkPoint[];
    allAttempts: SparkPoint[];
    allPalettes: SparkPoint[];
  };
  heatmap: {
    attempts: SparkPoint[];
    palettes: SparkPoint[];
  };
  pokedex: PokedexRow[];
  generatedAt: string;
}

// --- helpers ---------------------------------------------------------------

const numberFormatter = new Intl.NumberFormat("en-US");
const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
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
const monthShort = new Intl.DateTimeFormat("en-US", {
  month: "short",
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

function officialArtworkUrl(pokemonId: number) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonId}.png`;
}

function pokemonDisplayName(name: string | null | undefined, id: number) {
  if (name) return name.charAt(0).toUpperCase() + name.slice(1);
  return `#${id.toString().padStart(4, "0")}`;
}

/** Convert an absolute series into a running-total series. */
function toCumulative(points: SparkPoint[]): SparkPoint[] {
  let acc = 0;
  return points.map((p) => {
    acc += p.count;
    return { date: p.date, count: acc };
  });
}

/**
 * Merge two same-length time series into chart-ready rows of the shape
 * `{ date: string, [aKey]: number, [bKey]: number }`. We can't express that
 * with `{ date: string } & Record<string, number>` (the index signature
 * would force `date` to be a number too), so the row type is the union
 * `string | number` and Recharts narrows it back to numbers via dataKey.
 */
type MergedRow = { date: string } & { [k: string]: string | number };

function mergeSeries(
  a: SparkPoint[],
  b: SparkPoint[],
  aKey: string,
  bKey: string,
): MergedRow[] {
  const map = new Map<string, Record<string, number>>();
  for (const p of a) map.set(p.date, { [aKey]: p.count, [bKey]: 0 });
  for (const p of b) {
    const row = map.get(p.date) ?? { [aKey]: 0, [bKey]: 0 };
    row[bKey] = p.count;
    map.set(p.date, row);
  }
  return Array.from(map.entries())
    .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
    .map(([date, row]) => ({ date, ...row }));
}

// --- component -------------------------------------------------------------

type GrowthSeries = "attempts" | "palettes" | "both";
type HeatmapSeries = "attempts" | "palettes";

export function AdminInsights() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialRange = React.useMemo(
    () => rangeFromSearchParams(searchParams, "90d"),
    [searchParams],
  );
  const [range, setRange] = React.useState<RangeValue>(initialRange);

  React.useEffect(() => {
    setRange(rangeFromSearchParams(searchParams, "90d"));
  }, [searchParams]);

  const [data, setData] = React.useState<InsightsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [growthMode, setGrowthMode] = React.useState<GrowthSeries>("both");
  const [heatmapMode, setHeatmapMode] = React.useState<HeatmapSeries>(
    "attempts",
  );

  const queryString = React.useMemo(() => {
    const params = new URLSearchParams();
    if (range.preset === "custom") {
      params.set("from", range.from);
      params.set("to", range.to);
    } else {
      params.set("range", range.preset);
    }
    return params.toString();
  }, [range]);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const url = `/api/admin/insights${queryString ? `?${queryString}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 403) throw new Error("Access denied.");
        if (res.status === 401) throw new Error("Please sign in.");
        throw new Error("Failed to load insights.");
      }
      const json = (await res.json()) as InsightsResponse;
      setData(json);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load insights.");
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
  const rangeLabel = data?.range.label ?? "";
  const deltaLabel = data?.range
    ? `vs previous ${data.range.days}d`
    : "vs previous period";

  return (
    <TooltipProvider delayDuration={150}>
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
                ? "Loading insights…"
                : data
                  ? `Updated ${formatRelative(data.generatedAt)}`
                  : ""}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh insights"
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
                Could not load insights
              </CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {/* All-time hero band */}
        <AllTimeBanner totals={totals} loading={loading} />

        {/* Range KPIs */}
        <section
          aria-label={`Range KPIs — ${rangeLabel}`}
          className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
        >
          <KpiCard
            label="Attempts"
            value={kpis?.attempts ?? 0}
            previous={kpis?.attemptsPrev}
            deltaLabel={deltaLabel}
            loading={loading}
            series={data?.series.rangeAttempts}
            icon={<Gamepad2 />}
          />
          <KpiCard
            label="Saved Palettes"
            value={kpis?.palettes ?? 0}
            previous={kpis?.palettesPrev}
            deltaLabel={deltaLabel}
            loading={loading}
            series={data?.series.rangePalettes}
            icon={<Palette />}
          />
          <KpiCard
            label="Signups"
            value={kpis?.signups ?? 0}
            previous={kpis?.signupsPrev}
            deltaLabel={deltaLabel}
            loading={loading}
            icon={<Users />}
          />
          <KpiCard
            label="Win Rate"
            value={kpis?.winRate ?? 0}
            previous={kpis?.winRatePrev}
            deltaLabel={deltaLabel}
            format="percent"
            loading={loading}
            icon={<Trophy />}
          />
          <KpiCard
            label="Pokémon Targeted"
            value={kpis?.pokemonTargeted ?? 0}
            loading={loading}
            icon={<Sparkles />}
            hint="Distinct daily targets played"
          />
          <KpiCard
            label="Pokémon Palettized"
            value={kpis?.pokemonPalettized ?? 0}
            loading={loading}
            icon={<MapIcon />}
            hint="Distinct species saved"
          />
        </section>

        {/* Cumulative growth */}
        <section aria-label="Cumulative growth">
          <Card className="gap-3">
            <CardHeader className="gap-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="size-4" aria-hidden="true" />
                    Cumulative growth
                  </CardTitle>
                  <CardDescription>
                    Running totals since the very first record. Watch the slope
                    — steeper = faster product growth.
                  </CardDescription>
                </div>
                <Tabs
                  value={growthMode}
                  onValueChange={(v) => setGrowthMode(v as GrowthSeries)}
                >
                  <TabsList className="h-8">
                    <TabsTrigger value="both" className="px-2.5 text-xs">
                      Both
                    </TabsTrigger>
                    <TabsTrigger value="attempts" className="px-2.5 text-xs">
                      Attempts
                    </TabsTrigger>
                    <TabsTrigger value="palettes" className="px-2.5 text-xs">
                      Palettes
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {loading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <CumulativeChart
                  attempts={toCumulative(data?.series.allAttempts ?? [])}
                  palettes={toCumulative(data?.series.allPalettes ?? [])}
                  mode={growthMode}
                />
              )}
            </CardContent>
          </Card>
        </section>

        {/* Activity heatmap */}
        <section aria-label="Activity heatmap">
          <Card className="gap-3">
            <CardHeader className="gap-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Flame className="size-4" aria-hidden="true" />
                    Last 365 days
                  </CardTitle>
                  <CardDescription>
                    A daily pulse of activity. Each square is one day; darker =
                    busier.
                  </CardDescription>
                </div>
                <Tabs
                  value={heatmapMode}
                  onValueChange={(v) => setHeatmapMode(v as HeatmapSeries)}
                >
                  <TabsList className="h-8">
                    <TabsTrigger value="attempts" className="px-2.5 text-xs">
                      <Gamepad2 className="mr-1 size-3.5" />
                      Attempts
                    </TabsTrigger>
                    <TabsTrigger value="palettes" className="px-2.5 text-xs">
                      <Palette className="mr-1 size-3.5" />
                      Palettes
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {loading ? (
                <Skeleton className="h-[180px] w-full" />
              ) : (
                <YearHeatmap
                  data={
                    heatmapMode === "attempts"
                      ? (data?.heatmap.attempts ?? [])
                      : (data?.heatmap.palettes ?? [])
                  }
                  label={
                    heatmapMode === "attempts" ? "attempts" : "palettes"
                  }
                />
              )}
            </CardContent>
          </Card>
        </section>

        {/* Audience world map */}
        <section aria-label="Audience world map">
          <AdminInsightsWorldMap />
        </section>

        {/* Pokédex map */}
        <section aria-label="Pokédex coverage map">
          <Card className="gap-3">
            <CardHeader className="gap-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapIcon className="size-4" aria-hidden="true" />
                    Pokédex coverage map
                  </CardTitle>
                  <CardDescription>
                    Every Pokémon that has ever been a daily target or saved as
                    a palette. Cell heat = 1×attempts + 3×palette saves.
                  </CardDescription>
                </div>
                {totals ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                    <Badge variant="secondary">
                      {numberFormatter.format(data?.pokedex.length ?? 0)}{" "}
                      species
                    </Badge>
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {loading ? (
                <Skeleton className="h-[420px] w-full" />
              ) : (
                <PokedexMap pokedex={data?.pokedex ?? []} />
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </TooltipProvider>
  );
}

// --- All-time banner -------------------------------------------------------

function AllTimeBanner({
  totals,
  loading,
}: {
  totals: InsightsResponse["totals"] | undefined;
  loading: boolean;
}) {
  return (
    <section aria-label="All-time totals">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"
            >
              <Sparkles className="size-4" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                All-time
              </p>
              <p className="text-sm">Cumulative product totals since launch</p>
            </div>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
            <Stat
              label="Attempts"
              value={totals?.attempts}
              loading={loading}
            />
            <Stat
              label="Wins"
              value={totals?.wins}
              loading={loading}
            />
            <Stat
              label="Palettes"
              value={totals?.palettes}
              loading={loading}
            />
            <Stat
              label="Players"
              value={totals?.players}
              loading={loading}
            />
            <Stat
              label="Palettists"
              value={totals?.palettists}
              loading={loading}
            />
            <Stat
              label="Users"
              value={totals?.users}
              loading={loading}
            />
          </div>
        </CardContent>
      </Card>
    </section>
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

// --- Cumulative chart ------------------------------------------------------

function CumulativeChart({
  attempts,
  palettes,
  mode,
}: {
  attempts: SparkPoint[];
  palettes: SparkPoint[];
  mode: GrowthSeries;
}) {
  const id = React.useId().replace(/[:]/g, "");
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const data = React.useMemo(
    () => mergeSeries(attempts, palettes, "attempts", "palettes"),
    [attempts, palettes],
  );

  const totalAttempts = attempts[attempts.length - 1]?.count ?? 0;
  const totalPalettes = palettes[palettes.length - 1]?.count ?? 0;

  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Not enough history yet — come back once you have some plays and
        palettes.
      </div>
    );
  }

  // Window the data for "single series" modes so the y-axis stays meaningful.
  const showAttempts = mode === "both" || mode === "attempts";
  const showPalettes = mode === "both" || mode === "palettes";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-xs text-muted-foreground tabular-nums">
        {showAttempts ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block size-2.5 rounded-sm bg-primary"
            />
            <span className="text-foreground">
              {numberFormatter.format(totalAttempts)}
            </span>{" "}
            attempts
          </span>
        ) : null}
        {showPalettes ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block size-2.5 rounded-sm bg-emerald-500"
            />
            <span className="text-foreground">
              {numberFormatter.format(totalPalettes)}
            </span>{" "}
            palettes saved
          </span>
        ) : null}
      </div>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 8, bottom: 0, left: -8 }}
          >
            <defs>
              <linearGradient
                id={`growthAttempts-${id}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="var(--primary)"
                  stopOpacity={0.35}
                />
                <stop
                  offset="100%"
                  stopColor="var(--primary)"
                  stopOpacity={0}
                />
              </linearGradient>
              <linearGradient
                id={`growthPalettes-${id}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity={0} />
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
              minTickGap={32}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickFormatter={(v: number) => compactFormatter.format(v)}
              allowDecimals={false}
            />
            <RechartsTooltip
              cursor={{ stroke: "currentColor", strokeOpacity: 0.2 }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
                padding: "6px 10px",
                color: "var(--popover-foreground)",
              }}
              labelFormatter={(v: string) => {
                const d = new Date(`${v}T00:00:00Z`);
                return Number.isNaN(d.getTime()) ? v : dateLong.format(d);
              }}
              formatter={(v: number, name: string) => [
                numberFormatter.format(v),
                name === "attempts" ? "Attempts" : "Palettes",
              ]}
            />
            {showAttempts ? (
              <Area
                type="monotone"
                dataKey="attempts"
                stroke="var(--primary)"
                strokeWidth={2}
                fill={`url(#growthAttempts-${id})`}
                isAnimationActive={!reducedMotion}
                animationDuration={500}
              />
            ) : null}
            {showPalettes ? (
              <Area
                type="monotone"
                dataKey="palettes"
                stroke="rgb(16 185 129)"
                strokeWidth={2}
                fill={`url(#growthPalettes-${id})`}
                isAnimationActive={!reducedMotion}
                animationDuration={500}
              />
            ) : null}
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingBottom: 8 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// --- Year heatmap (GitHub-style) ------------------------------------------

function heatBucket(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || max <= 0) return 0;
  const ratio = count / max;
  if (ratio < 0.2) return 1;
  if (ratio < 0.4) return 2;
  if (ratio < 0.7) return 3;
  return 4;
}

const HEATMAP_BUCKET_CLASS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-muted/40",
  1: "bg-primary/15",
  2: "bg-primary/35",
  3: "bg-primary/60",
  4: "bg-primary/90",
};

function YearHeatmap({
  data,
  label,
}: {
  data: SparkPoint[];
  label: string;
}) {
  // Build columns of 7 days (Sun..Sat). Pad the leading days so the first
  // column starts on Sunday.
  const cells = React.useMemo(() => {
    const sorted = [...data].sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
    );
    const firstSorted = sorted[0];
    if (!firstSorted) return [] as Array<SparkPoint & { dow: number }>;

    const firstDate = new Date(`${firstSorted.date}T00:00:00Z`);
    const startDow = firstDate.getUTCDay();
    const padded: Array<{ date: string; count: number; dow: number; pad?: boolean }> = [];
    for (let i = 0; i < startDow; i++) {
      padded.push({ date: "", count: 0, dow: i, pad: true });
    }
    for (const p of sorted) {
      const d = new Date(`${p.date}T00:00:00Z`);
      padded.push({ date: p.date, count: p.count, dow: d.getUTCDay() });
    }
    return padded;
  }, [data]);

  const max = React.useMemo(() => {
    let m = 0;
    for (const p of data) if (p.count > m) m = p.count;
    return m;
  }, [data]);

  const total = React.useMemo(
    () => data.reduce((acc, p) => acc + p.count, 0),
    [data],
  );

  // Build column groups (each = 7 cells), then month labels by detecting
  // when the column's first non-pad date crosses a month boundary.
  const columns = React.useMemo(() => {
    const out: Array<Array<(typeof cells)[number]>> = [];
    for (let i = 0; i < cells.length; i += 7) {
      out.push(cells.slice(i, i + 7));
    }
    return out;
  }, [cells]);

  const monthLabels = React.useMemo(() => {
    const out: Array<{ col: number; label: string }> = [];
    let lastMonth = -1;
    columns.forEach((col, i) => {
      const firstReal = col.find((c) => !("pad" in c) || !c.pad);
      if (!firstReal || !firstReal.date) return;
      const d = new Date(`${firstReal.date}T00:00:00Z`);
      const m = d.getUTCMonth();
      if (m !== lastMonth) {
        lastMonth = m;
        out.push({ col: i, label: monthShort.format(d) });
      }
    });
    return out;
  }, [columns]);

  if (data.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        No {label} recorded in the last 365 days.
      </div>
    );
  }

  const cellSize = "size-3 sm:size-3.5";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted-foreground tabular-nums">
        <span>
          <span className="text-foreground font-medium">
            {numberFormatter.format(total)}
          </span>{" "}
          {label} in the last year
        </span>
        <HeatmapLegend />
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex min-w-full flex-col gap-1">
          {/* Month labels row. */}
          <div className="relative h-3.5 text-[10px] text-muted-foreground">
            <div className="flex gap-0.5">
              {columns.map((_, i) => {
                const m = monthLabels.find((x) => x.col === i);
                return (
                  <div
                    key={`m-${i}`}
                    className={cn(cellSize, "relative")}
                    aria-hidden="true"
                  >
                    {m ? (
                      <span className="absolute left-0 top-0 whitespace-nowrap">
                        {m.label}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          {/* 7 rows × N cols grid. */}
          <div
            role="grid"
            aria-label={`${label} heatmap for the last 365 days`}
            className="flex gap-0.5 text-primary"
          >
            {columns.map((col, i) => (
              <div
                key={`c-${i}`}
                className="flex flex-col gap-0.5"
                role="row"
              >
                {Array.from({ length: 7 }).map((_, dow) => {
                  const cell = col[dow];
                  if (!cell || ("pad" in cell && cell.pad) || !cell.date) {
                    return (
                      <div
                        key={`p-${i}-${dow}`}
                        className={cn(cellSize, "rounded-sm bg-transparent")}
                        role="gridcell"
                        aria-hidden="true"
                      />
                    );
                  }
                  const bucket = heatBucket(cell.count, max);
                  const date = new Date(`${cell.date}T00:00:00Z`);
                  return (
                    <Tooltip key={cell.date}>
                      <TooltipTrigger asChild>
                        <div
                          role="gridcell"
                          tabIndex={0}
                          aria-label={`${dateLong.format(date)}: ${cell.count} ${label}`}
                          className={cn(
                            cellSize,
                            "rounded-sm transition-colors",
                            HEATMAP_BUCKET_CLASS[bucket],
                            "hover:ring-1 hover:ring-ring focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
                          )}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <div className="text-xs">
                          <div className="font-medium">
                            {dateLong.format(date)}
                          </div>
                          <div className="text-muted-foreground tabular-nums">
                            {numberFormatter.format(cell.count)} {label}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeatmapLegend() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px]">
      <span>Less</span>
      <span
        aria-hidden="true"
        className="inline-block size-3 rounded-sm bg-muted/40"
      />
      <span
        aria-hidden="true"
        className="inline-block size-3 rounded-sm bg-primary/15"
      />
      <span
        aria-hidden="true"
        className="inline-block size-3 rounded-sm bg-primary/35"
      />
      <span
        aria-hidden="true"
        className="inline-block size-3 rounded-sm bg-primary/60"
      />
      <span
        aria-hidden="true"
        className="inline-block size-3 rounded-sm bg-primary/90"
      />
      <span>More</span>
    </span>
  );
}

// --- Pokédex coverage map --------------------------------------------------

type PokedexSort = "score" | "attempts" | "palettes" | "id";

function PokedexMap({ pokedex }: { pokedex: PokedexRow[] }) {
  const [sort, setSort] = React.useState<PokedexSort>("score");
  const [showAll, setShowAll] = React.useState(false);

  const sorted = React.useMemo(() => {
    const rows = [...pokedex];
    rows.sort((a, b) => {
      if (sort === "id") return a.pokemon_id - b.pokemon_id;
      if (sort === "attempts") return b.attempts - a.attempts;
      if (sort === "palettes") return b.palettes - a.palettes;
      return b.score - a.score;
    });
    return rows;
  }, [pokedex, sort]);

  const visible = showAll ? sorted : sorted.slice(0, 96);

  const maxScore = React.useMemo(() => {
    let m = 0;
    for (const p of pokedex) if (p.score > m) m = p.score;
    return m;
  }, [pokedex]);

  if (pokedex.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        No Pokémon engagement recorded yet.
      </div>
    );
  }

  const top = sorted[0];
  const colder = [...pokedex].sort((a, b) => a.score - b.score)[0];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          value={sort}
          onValueChange={(v) => setSort(v as PokedexSort)}
        >
          <TabsList className="h-8">
            <TabsTrigger value="score" className="px-2.5 text-xs">
              Engagement
            </TabsTrigger>
            <TabsTrigger value="attempts" className="px-2.5 text-xs">
              Attempts
            </TabsTrigger>
            <TabsTrigger value="palettes" className="px-2.5 text-xs">
              Palettes
            </TabsTrigger>
            <TabsTrigger value="id" className="px-2.5 text-xs">
              Pokédex #
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          {top ? (
            <span className="inline-flex items-center gap-1">
              <ArrowUpRight
                aria-hidden="true"
                className="size-3 text-emerald-500"
              />
              Hottest:{" "}
              <Link
                href={`/admin/palettes?pokemon_id=${top.pokemon_id}`}
                className="text-foreground font-medium hover:underline"
              >
                {pokemonDisplayName(top.pokemon_name, top.pokemon_id)}
              </Link>
            </span>
          ) : null}
          {colder && colder !== top ? (
            <span className="inline-flex items-center gap-1">
              <ArrowDownRight
                aria-hidden="true"
                className="size-3 text-rose-500"
              />
              Quietest:{" "}
              <Link
                href={`/admin/palettes?pokemon_id=${colder.pokemon_id}`}
                className="text-foreground font-medium hover:underline"
              >
                {pokemonDisplayName(colder.pokemon_name, colder.pokemon_id)}
              </Link>
            </span>
          ) : null}
        </div>
      </div>

      <div
        role="grid"
        aria-label="Pokédex engagement map"
        className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-16"
      >
        {visible.map((row) => (
          <PokedexCell key={row.pokemon_id} row={row} maxScore={maxScore} />
        ))}
      </div>

      {sorted.length > 96 ? (
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-muted-foreground tabular-nums">
            Showing {visible.length.toLocaleString()} of{" "}
            {sorted.length.toLocaleString()} species
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAll((s) => !s)}
            className="h-7 text-xs"
          >
            {showAll ? "Show top 96" : "Show all species"}
          </Button>
        </div>
      ) : null}

      <PokedexLegend />
    </div>
  );
}

function PokedexCell({
  row,
  maxScore,
}: {
  row: PokedexRow;
  maxScore: number;
}) {
  const bucket = heatBucket(row.score, maxScore);
  const winRate = row.attempts > 0 ? (row.wins / row.attempts) * 100 : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={`/admin/palettes?pokemon_id=${row.pokemon_id}`}
          className={cn(
            "group relative aspect-square overflow-hidden rounded-md border transition-colors",
            HEATMAP_BUCKET_CLASS[bucket],
            "hover:ring-2 hover:ring-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          )}
          aria-label={`${pokemonDisplayName(row.pokemon_name, row.pokemon_id)} — score ${row.score}`}
        >
          <Image
            src={officialArtworkUrl(row.pokemon_id)}
            alt=""
            fill
            sizes="64px"
            className={cn(
              "object-contain transition-opacity",
              "brightness-0 dark:invert",
              bucket === 0 ? "opacity-40" : "opacity-65",
            )}
            unoptimized
          />
          <span className="absolute left-1 top-1 rounded bg-background/80 px-1 text-[9px] font-mono font-semibold tabular-nums backdrop-blur-sm">
            #{row.pokemon_id.toString().padStart(4, "0")}
          </span>
          {row.score > 0 ? (
            <span className="absolute bottom-1 right-1 rounded bg-background/80 px-1 text-[9px] font-medium tabular-nums backdrop-blur-sm">
              {compactFormatter.format(row.score)}
            </span>
          ) : null}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[14rem]">
        <div className="space-y-0.5 text-xs">
          <div className="font-medium">
            {pokemonDisplayName(row.pokemon_name, row.pokemon_id)}
          </div>
          <div className="text-muted-foreground font-mono tabular-nums">
            #{row.pokemon_id.toString().padStart(4, "0")}
          </div>
          <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5">
            <span className="text-muted-foreground">Attempts</span>
            <span className="text-right tabular-nums">
              {numberFormatter.format(row.attempts)}
            </span>
            <span className="text-muted-foreground">Wins</span>
            <span className="text-right tabular-nums">
              {numberFormatter.format(row.wins)}
              {winRate !== null ? ` (${winRate.toFixed(0)}%)` : ""}
            </span>
            <span className="text-muted-foreground">Palettes</span>
            <span className="text-right tabular-nums">
              {numberFormatter.format(row.palettes)}
            </span>
            <span className="text-muted-foreground">Score</span>
            <span className="text-right tabular-nums font-medium">
              {numberFormatter.format(row.score)}
            </span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function PokedexLegend() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground">
      <div className="inline-flex items-center gap-1.5">
        <span>Cold</span>
        <span
          aria-hidden="true"
          className="inline-block size-3 rounded-sm bg-muted/40"
        />
        <span
          aria-hidden="true"
          className="inline-block size-3 rounded-sm bg-primary/15"
        />
        <span
          aria-hidden="true"
          className="inline-block size-3 rounded-sm bg-primary/35"
        />
        <span
          aria-hidden="true"
          className="inline-block size-3 rounded-sm bg-primary/60"
        />
        <span
          aria-hidden="true"
          className="inline-block size-3 rounded-sm bg-primary/90"
        />
        <span>Hot</span>
      </div>
      <span>
        Click any cell to view that Pokémon&apos;s saved palettes →
      </span>
    </div>
  );
}
