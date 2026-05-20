"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Globe2, Info, ShieldCheck, Users } from "lucide-react";
import { geoNaturalEarth1, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  ISO_COUNTRIES,
  NUMERIC_TO_ALPHA2,
  countryName,
} from "@/lib/data/iso-countries";
import {
  rangeFromSearchParams,
  type RangeValue,
} from "@/lib/admin/range";

// --- types -----------------------------------------------------------------

interface GeoRow {
  country_code: string;
  users: number;
  active_in_range: number;
  attempts_in_range: number;
  palettes_in_range: number;
}

interface GeographyResponse {
  range: { label: string; days: number };
  coverage: { located: number; total: number };
  rows: GeoRow[];
  generatedAt: string;
}

// --- constants -------------------------------------------------------------

// 110m world atlas, hosted on jsDelivr's npm mirror. ~120KB gzipped, cached
// across all admins. The file is keyed by numeric ISO 3166-1 codes which we
// cross-reference via `NUMERIC_TO_ALPHA2`.
const WORLD_ATLAS_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Five-stop heat scale. Tied to Tailwind's `--primary` token via inline
// styles below — defined as opacity steps so it adapts to dark mode.
const HEAT_OPACITY = [0, 0.18, 0.36, 0.55, 0.72, 0.9] as const;

const numberFormatter = new Intl.NumberFormat("en-US");

// --- topojson loading ------------------------------------------------------

interface CountryFeature {
  id: string;
  name: string;
  alpha2: string | null;
  d: string;
  bounds: [[number, number], [number, number]];
}

interface WorldData {
  features: CountryFeature[];
  projectionWidth: number;
  projectionHeight: number;
}

let worldDataPromise: Promise<WorldData> | null = null;

async function loadWorldData(): Promise<WorldData> {
  if (!worldDataPromise) {
    worldDataPromise = (async () => {
      const res = await fetch(WORLD_ATLAS_URL, { cache: "force-cache" });
      if (!res.ok) {
        throw new Error(`Failed to fetch world atlas (${res.status})`);
      }
      const topology = (await res.json()) as Topology;
      const collection = topology.objects.countries as GeometryCollection<{
        name?: string;
      }>;
      const geo = feature(topology, collection);

      // The projection size is somewhat arbitrary — d3-geo takes care of
      // scaling. We pick 800×400 as a clean Natural Earth aspect.
      const width = 800;
      const height = 400;
      const projection = geoNaturalEarth1().fitSize(
        [width, height],
        geo as GeoPermissibleObjects,
      );
      const path = geoPath(projection);

      const features: CountryFeature[] = geo.features.map((f, idx) => {
        const numericId = String(f.id ?? "").padStart(3, "0");
        const id = f.id ? numericId : `_${idx}`;
        const alpha2 = NUMERIC_TO_ALPHA2[numericId] ?? null;
        const props = (f.properties ?? {}) as { name?: string };
        const name = alpha2
          ? (ISO_COUNTRIES[alpha2]?.name ?? props.name ?? "Unknown")
          : (props.name ?? "Unknown");
        return {
          id,
          name,
          alpha2,
          d: path(f) ?? "",
          bounds: path.bounds(f) as [[number, number], [number, number]],
        };
      });

      return { features, projectionWidth: width, projectionHeight: height };
    })();
  }
  return worldDataPromise;
}

// --- component -------------------------------------------------------------

export function AdminInsightsWorldMap() {
  const searchParams = useSearchParams();
  const [data, setData] = React.useState<GeographyResponse | null>(null);
  const [world, setWorld] = React.useState<WorldData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Match the range the rest of the page uses so KPIs and the map agree.
  const queryString = React.useMemo(() => {
    const range: RangeValue = rangeFromSearchParams(searchParams, "90d");
    const next = new URLSearchParams();
    if (range.preset === "custom") {
      next.set("from", range.from);
      next.set("to", range.to);
    } else {
      next.set("range", range.preset);
    }
    return next.toString();
  }, [searchParams]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(
        `/api/admin/insights/geography${queryString ? `?${queryString}` : ""}`,
        { cache: "no-store" },
      ).then(async (res) => {
        if (!res.ok) {
          if (res.status === 403) throw new Error("Access denied.");
          if (res.status === 401) throw new Error("Please sign in.");
          throw new Error("Failed to load geography.");
        }
        return (await res.json()) as GeographyResponse;
      }),
      loadWorldData(),
    ])
      .then(([apiData, worldData]) => {
        if (cancelled) return;
        setData(apiData);
        setWorld(worldData);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [queryString]);

  return (
    <Card className="gap-3">
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe2 className="size-4" aria-hidden="true" />
              Audience map
            </CardTitle>
            <CardDescription>
              Where signed-in users are located, derived from edge headers on
              their first visit. Country-level only — no IP, region, or city
              is stored.
            </CardDescription>
          </div>
          {data ? (
            <CoverageBadge
              located={data.coverage.located}
              total={data.coverage.total}
            />
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {error ? (
          <ErrorState message={error} />
        ) : loading || !data || !world ? (
          <Skeleton className="h-[420px] w-full" />
        ) : data.rows.length === 0 ? (
          <EmptyState />
        ) : (
          <WorldMapBody data={data} world={world} />
        )}
      </CardContent>
    </Card>
  );
}

// --- map body --------------------------------------------------------------

function WorldMapBody({
  data,
  world,
}: {
  data: GeographyResponse;
  world: WorldData;
}) {
  const byAlpha2 = React.useMemo(() => {
    const map = new Map<string, GeoRow>();
    for (const row of data.rows) map.set(row.country_code.toUpperCase(), row);
    return map;
  }, [data.rows]);

  const max = React.useMemo(() => {
    let m = 0;
    for (const row of data.rows) if (row.users > m) m = row.users;
    return m;
  }, [data.rows]);

  const top = React.useMemo(
    () =>
      [...data.rows].sort((a, b) => b.users - a.users).slice(0, 10),
    [data.rows],
  );

  const totalUsersWithCountry = React.useMemo(
    () => data.rows.reduce((acc, r) => acc + r.users, 0),
    [data.rows],
  );

  return (
    <TooltipProvider delayDuration={120}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-2">
          <div
            className="overflow-hidden rounded-lg border p-2"
            style={{
              background: "color-mix(in oklch, var(--primary) 4%, transparent)",
            }}
          >
            <svg
              role="img"
              aria-label="World map of user countries"
              viewBox={`0 0 ${world.projectionWidth} ${world.projectionHeight}`}
              className="block h-auto w-full text-primary"
            >
              {/* Ocean fill — subtly tinted so land stands out. */}
              <rect
                x={0}
                y={0}
                width={world.projectionWidth}
                height={world.projectionHeight}
                style={{ fill: "var(--primary)", fillOpacity: 0.06 }}
              />
              {world.features.map((f) => {
                const row = f.alpha2 ? byAlpha2.get(f.alpha2) : undefined;
                const bucket = row ? heatBucket(row.users, max) : 0;
                return (
                  <CountryShape
                    key={f.id}
                    feature={f}
                    bucket={bucket}
                    row={row}
                  />
                );
              })}
            </svg>
            <MapLegend max={max} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            <Info aria-hidden="true" className="mr-1 inline size-3" />
            Hover any country for details. Some Vercel edge headers may
            return <code>XX</code> for unknown locations — those users are
            not counted.
          </p>
        </div>

        <aside aria-label="Top countries" className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-medium">Top countries</h3>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {numberFormatter.format(totalUsersWithCountry)} located
            </span>
          </div>
          <ol className="space-y-1.5" role="list">
            {top.map((row, idx) => {
              const ratio =
                totalUsersWithCountry > 0
                  ? (row.users / totalUsersWithCountry) * 100
                  : 0;
              return (
                <li key={row.country_code}>
                  <div
                    className="group flex items-center gap-3 rounded-md p-1.5 -mx-1.5 transition-colors hover:bg-accent"
                    title={countryName(row.country_code)}
                  >
                    <span className="w-4 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                      {idx + 1}
                    </span>
                    <FlagImage code={row.country_code} size={20} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {countryName(row.country_code)}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground tabular-nums">
                        {numberFormatter.format(row.users)} users · {ratio.toFixed(1)}%
                      </p>
                    </div>
                    <Badge variant="secondary" className="tabular-nums">
                      {numberFormatter.format(row.users)}
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ol>
          {data.rows.length > top.length ? (
            <p className="pt-1 text-[11px] text-muted-foreground tabular-nums">
              + {numberFormatter.format(data.rows.length - top.length)} more
              countries
            </p>
          ) : null}
        </aside>
      </div>
    </TooltipProvider>
  );
}

function CountryShape({
  feature: f,
  bucket,
  row,
}: {
  feature: CountryFeature;
  bucket: 0 | 1 | 2 | 3 | 4 | 5;
  row: GeoRow | undefined;
}) {
  if (!f.d) return null;

  // bucket 0 = no users → solid neutral land fill.
  // bucket 1–5 = has users → primary-tinted heat.
  const fillStyle: React.CSSProperties =
    bucket === 0
      ? { fill: "var(--muted-foreground)", fillOpacity: 0.18 }
      : { fill: "var(--primary)", fillOpacity: HEAT_OPACITY[bucket] };

  const path = (
    <path
      d={f.d}
      style={fillStyle}
      className={cn(
        "transition-[fill-opacity,fill] duration-200 cursor-pointer",
        bucket === 0
          ? "stroke-background/80 hover:[fill-opacity:0.3]"
          : "stroke-background hover:[fill-opacity:1]",
      )}
      strokeWidth={0.5}
      vectorEffect="non-scaling-stroke"
      aria-label={f.name}
    />
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{path}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-[16rem]">
        <div className="space-y-0.5 text-xs">
          <div className="flex items-center gap-1.5 font-medium">
            {f.alpha2 ? (
              <FlagImage code={f.alpha2} size={16} />
            ) : null}
            <span>{f.name}</span>
          </div>
          {row ? (
            <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5">
              <span className="text-muted-foreground">Users</span>
              <span className="text-right tabular-nums">
                {numberFormatter.format(row.users)}
              </span>
              <span className="text-muted-foreground">Active</span>
              <span className="text-right tabular-nums">
                {numberFormatter.format(row.active_in_range)}
              </span>
              <span className="text-muted-foreground">Attempts</span>
              <span className="text-right tabular-nums">
                {numberFormatter.format(row.attempts_in_range)}
              </span>
              <span className="text-muted-foreground">Palettes</span>
              <span className="text-right tabular-nums">
                {numberFormatter.format(row.palettes_in_range)}
              </span>
            </div>
          ) : (
            <p className="mt-1 text-muted-foreground">No users yet.</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// --- flag image ------------------------------------------------------------

/**
 * Renders a country flag as an `<img>` loaded from flagcdn.com, a free CDN
 * that hosts every ISO 3166-1 alpha-2 flag as an SVG. Falls back to the
 * alpha-2 code as text if the image fails.
 */
function FlagImage({ code, size = 16 }: { code: string; size?: number }) {
  const lower = code.toLowerCase();
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/${lower}.svg`}
      alt={`${countryName(code)} flag`}
      width={Math.round(size * 1.33)}
      height={size}
      loading="lazy"
      className="inline-block shrink-0 rounded-[2px] object-cover"
      style={{ width: Math.round(size * 1.33), height: size }}
      onError={(e) => {
        const target = e.currentTarget;
        target.style.display = "none";
      }}
    />
  );
}

// --- supporting bits -------------------------------------------------------

function heatBucket(value: number, max: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (value <= 0 || max <= 0) return 0;
  const ratio = value / max;
  if (ratio < 0.05) return 1;
  if (ratio < 0.15) return 2;
  if (ratio < 0.35) return 3;
  if (ratio < 0.65) return 4;
  return 5;
}

function MapLegend({ max }: { max: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-2 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <Users aria-hidden="true" className="size-3" />
        Users per country
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span>0</span>
        <span
          aria-hidden="true"
          className="inline-block size-3 rounded-sm"
          style={{
            backgroundColor:
              "color-mix(in oklch, var(--muted-foreground) 18%, transparent)",
          }}
        />
        {HEAT_OPACITY.slice(1).map((op, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="inline-block size-3 rounded-sm"
            style={{
              backgroundColor: "var(--primary)",
              opacity: op,
            }}
          />
        ))}
        <span className="tabular-nums">{numberFormatter.format(max)}+</span>
      </span>
    </div>
  );
}

function CoverageBadge({
  located,
  total,
}: {
  located: number;
  total: number;
}) {
  const pct = total > 0 ? (located / total) * 100 : 0;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex cursor-help items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground"
          aria-label={`${located.toLocaleString()} of ${total.toLocaleString()} users have a country code (${pct.toFixed(0)}%)`}
        >
          <ShieldCheck className="size-3.5 text-emerald-500" aria-hidden="true" />
          {numberFormatter.format(located)} / {numberFormatter.format(total)}{" "}
          located
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[18rem]">
        <p className="text-xs">
          Users get a country code on their first authenticated request once
          the geo capture endpoint is wired up. Older accounts will fill in
          gradually as people return.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

function EmptyState() {
  return (
    <div className="space-y-3 rounded-md border border-dashed p-6 text-sm">
      <div className="flex items-start gap-3">
        <Globe2
          aria-hidden="true"
          className="size-5 shrink-0 text-muted-foreground"
        />
        <div className="space-y-1">
          <p className="font-medium">No country data yet</p>
          <p className="text-muted-foreground">
            Country codes start populating as signed-in users hit the site
            after the geo capture endpoint is deployed. Sign in once on
            production to seed the map with your own location.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pl-8 text-xs text-muted-foreground">
        <Link
          href="/admin/users"
          className="rounded border px-2 py-1 hover:bg-accent"
        >
          Open users table →
        </Link>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed text-sm text-destructive">
      {message}
    </div>
  );
}
