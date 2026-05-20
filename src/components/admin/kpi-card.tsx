"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SparkPoint {
  date: string;
  count: number;
}

interface KpiCardProps {
  label: string;
  value: number | string;
  suffix?: string;
  hint?: string;
  series?: SparkPoint[];
  icon?: React.ReactNode;
  loading?: boolean;
  format?: "number" | "percent";
  className?: string;
  /** Previous-period value. When provided alongside a numeric `value`, shows a delta chip. */
  previous?: number | null;
  /** Whether an increase is good (default) or bad (e.g. average attempts). Controls chip color. */
  deltaGoodDirection?: "up" | "down";
  /** Optional label describing what the delta compares to, e.g. "vs last 7d". */
  deltaLabel?: string;
}

function formatPct(n: number) {
  const sign = n > 0 ? "+" : "";
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) return `${sign}${Math.round(n)}%`;
  return `${sign}${n.toFixed(1)}%`;
}

function DeltaBadge({
  current,
  previous,
  goodDirection,
  label,
}: {
  current: number;
  previous: number | null | undefined;
  goodDirection: "up" | "down";
  label?: string;
}) {
  if (previous === null || previous === undefined) return null;

  // Both zero: flat, no delta useful.
  if (previous === 0 && current === 0) {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10.5px] font-medium text-muted-foreground"
        aria-label={`No change${label ? ` ${label}` : ""}`}
      >
        <Minus className="size-3" aria-hidden="true" />
        <span className="tabular-nums">0%</span>
      </span>
    );
  }

  // Coming from zero base: label as "new" since % change is undefined.
  if (previous === 0) {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-emerald-600 dark:text-emerald-400"
        aria-label={`New${label ? ` ${label}` : ""}`}
      >
        <ArrowUpRight className="size-3" aria-hidden="true" />
        <span>new</span>
      </span>
    );
  }

  const change = ((current - previous) / Math.abs(previous)) * 100;
  const up = change > 0;
  const flat = change === 0;
  const positive = flat ? null : goodDirection === "up" ? up : !up;
  const tone = flat
    ? "bg-muted text-muted-foreground"
    : positive
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : "bg-rose-500/10 text-rose-600 dark:text-rose-400";
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const aria = `${formatPct(change)}${label ? ` ${label}` : ""}`;

  return (
    <span
      title={label}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-medium tabular-nums",
        tone,
      )}
      aria-label={aria}
    >
      <Icon className="size-3" aria-hidden="true" />
      <span>{formatPct(change)}</span>
    </span>
  );
}

const numberFormatter = new Intl.NumberFormat("en-US");

function formatValue(value: number | string, format: KpiCardProps["format"]) {
  if (typeof value === "string") return value;
  if (format === "percent") return `${value.toFixed(1)}%`;
  return numberFormatter.format(value);
}

function Sparkline({ data, colorId }: { data: SparkPoint[]; colorId: string }) {
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  return (
    <div className="h-12 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id={colorId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.35} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" hide />
          <YAxis hide domain={[0, "dataMax + 1"]} />
          <Tooltip
            cursor={{ stroke: "currentColor", strokeOpacity: 0.15 }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              padding: "4px 8px",
              color: "var(--popover-foreground)",
            }}
            labelStyle={{ color: "var(--muted-foreground)" }}
            formatter={(v: number) => [numberFormatter.format(v), "Count"]}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="currentColor"
            strokeWidth={1.75}
            fill={`url(#${colorId})`}
            isAnimationActive={!reducedMotion}
            animationDuration={400}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  suffix,
  hint,
  series,
  icon,
  loading,
  format = "number",
  className,
  previous,
  deltaGoodDirection = "up",
  deltaLabel,
}: KpiCardProps) {
  const id = React.useId().replace(/[:]/g, "");
  const colorId = `sparkGradient-${id}`;
  const showDelta =
    !loading &&
    typeof value === "number" &&
    previous !== undefined &&
    previous !== null;

  return (
    <Card className={cn("gap-3 py-4", className)}>
      <CardHeader className="gap-1 px-4">
        <div className="flex items-center justify-between gap-2">
          <CardDescription className="text-xs font-medium uppercase tracking-wide">
            {label}
          </CardDescription>
          {icon ? (
            <span
              aria-hidden="true"
              className="text-muted-foreground [&>svg]:size-4"
            >
              {icon}
            </span>
          ) : null}
        </div>
        <div className="flex items-baseline gap-2">
          <CardTitle
            className="text-2xl font-semibold tabular-nums"
            aria-live="polite"
          >
            {loading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <>
                {formatValue(value, format)}
                {suffix ? (
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    {suffix}
                  </span>
                ) : null}
              </>
            )}
          </CardTitle>
          {showDelta ? (
            <DeltaBadge
              current={value as number}
              previous={previous}
              goodDirection={deltaGoodDirection}
              label={deltaLabel}
            />
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-0">
        {loading ? (
          <Skeleton className="h-12 w-full" />
        ) : series && series.length > 0 ? (
          <div className="text-primary">
            <Sparkline data={series} colorId={colorId} />
          </div>
        ) : hint ? (
          <p className="text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
