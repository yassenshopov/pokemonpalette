export type RangePreset = "7d" | "30d" | "90d" | "365d" | "custom";

export interface RangeValue {
  preset: RangePreset;
  /** ISO date (YYYY-MM-DD) inclusive start */
  from: string;
  /** ISO date (YYYY-MM-DD) inclusive end */
  to: string;
}

export interface ResolvedRange extends RangeValue {
  /** millisecond-precise UTC boundaries used for server queries */
  fromISO: string;
  toISO: string;
  prevFromISO: string;
  prevToISO: string;
  /** number of full days covered by [from, to] */
  days: number;
  label: string;
}

export const RANGE_PRESETS: ReadonlyArray<{
  id: Exclude<RangePreset, "custom">;
  label: string;
  shortLabel: string;
  days: number;
}> = [
  { id: "7d", label: "Last 7 days", shortLabel: "7d", days: 7 },
  { id: "30d", label: "Last 30 days", shortLabel: "30d", days: 30 },
  { id: "90d", label: "Last 90 days", shortLabel: "90d", days: 90 },
  { id: "365d", label: "Last 12 months", shortLabel: "1y", days: 365 },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function toIsoDate(d: Date): string {
  return startOfUtcDay(d).toISOString().slice(0, 10);
}

export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Resolve a RangeValue into the full set of boundaries used by the server.
 *
 * - `from` is inclusive start of day (UTC).
 * - `to` is inclusive end of day → query uses the *next* day at 00:00 UTC so
 *   the half-open [fromISO, toISO) matches the typical `>= from AND < to`
 *   predicate used by the admin RPCs.
 * - `prev*` is the equal-length period immediately before `from`.
 */
export function resolveRange(value: RangeValue): ResolvedRange {
  const fromDate = parseIsoDate(value.from) ?? startOfUtcDay(new Date());
  const toDate = parseIsoDate(value.to) ?? startOfUtcDay(new Date());
  const fromStart = startOfUtcDay(fromDate);
  const toEndExclusive = new Date(
    startOfUtcDay(toDate).getTime() + DAY_MS,
  );
  const days = Math.max(
    1,
    Math.round((toEndExclusive.getTime() - fromStart.getTime()) / DAY_MS),
  );
  const prevToExclusive = fromStart;
  const prevFrom = new Date(fromStart.getTime() - days * DAY_MS);

  const preset = RANGE_PRESETS.find((p) => p.id === value.preset);
  const label = preset
    ? preset.label
    : `${value.from} → ${value.to}`;

  return {
    ...value,
    from: toIsoDate(fromStart),
    to: toIsoDate(new Date(toEndExclusive.getTime() - DAY_MS)),
    fromISO: fromStart.toISOString(),
    toISO: toEndExclusive.toISOString(),
    prevFromISO: prevFrom.toISOString(),
    prevToISO: prevToExclusive.toISOString(),
    days,
    label,
  };
}

/** Build a RangeValue from URL search params (or sensible defaults). */
export function rangeFromSearchParams(
  params: URLSearchParams | null | undefined,
  fallback: Exclude<RangePreset, "custom"> = "30d",
): RangeValue {
  const rawRange = params?.get("range") ?? undefined;
  const from = params?.get("from");
  const to = params?.get("to");

  if (from && to && parseIsoDate(from) && parseIsoDate(to)) {
    return { preset: "custom", from, to };
  }

  const preset = RANGE_PRESETS.find((p) => p.id === rawRange);
  const active = preset?.id ?? fallback;
  return presetToRange(active);
}

export function presetToRange(id: Exclude<RangePreset, "custom">): RangeValue {
  const meta = RANGE_PRESETS.find((p) => p.id === id);
  const days = meta?.days ?? 30;
  const today = startOfUtcDay(new Date());
  const from = new Date(today.getTime() - (days - 1) * DAY_MS);
  return { preset: id, from: toIsoDate(from), to: toIsoDate(today) };
}

/** Write the range into existing URLSearchParams (mutates a copy and returns it). */
export function rangeToSearchParams(
  existing: URLSearchParams,
  value: RangeValue,
): URLSearchParams {
  const next = new URLSearchParams(existing.toString());
  next.delete("range");
  next.delete("from");
  next.delete("to");
  if (value.preset === "custom") {
    next.set("from", value.from);
    next.set("to", value.to);
  } else {
    // Don't emit the default preset so URLs stay clean.
    if (value.preset !== "30d") next.set("range", value.preset);
  }
  return next;
}
