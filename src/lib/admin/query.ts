/**
 * Shared query-parameter parsing for admin list endpoints.
 *
 * All admin list endpoints accept the same shape:
 *   page, pageSize, sort (field:dir), q (free text), plus arbitrary filters.
 * This module parses URLSearchParams into a typed, validated shape and
 * provides helpers for formatting paginated responses.
 */

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 200;

export type SortDir = "asc" | "desc";

export interface ParsedAdminQuery<
  TFilters extends Record<string, string | undefined> = Record<
    string,
    string | undefined
  >,
> {
  page: number;
  pageSize: number;
  sort: { field: string; dir: SortDir } | null;
  q: string | null;
  filters: TFilters;
  format: "json" | "csv";
}

export interface AdminQuerySchema<TFilterKey extends string> {
  sortable: readonly string[];
  defaultSort?: { field: string; dir: SortDir };
  filterKeys: readonly TFilterKey[];
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

function parseSort(
  raw: string | null,
  schema: AdminQuerySchema<string>,
): { field: string; dir: SortDir } | null {
  if (!raw) return schema.defaultSort ?? null;
  const [field, dirRaw] = raw.split(":");
  if (!field || !schema.sortable.includes(field)) {
    return schema.defaultSort ?? null;
  }
  const dir: SortDir = dirRaw === "asc" ? "asc" : "desc";
  return { field, dir };
}

export function parseAdminQuery<TFilterKey extends string>(
  searchParams: URLSearchParams,
  schema: AdminQuerySchema<TFilterKey>,
): ParsedAdminQuery<Record<TFilterKey, string | undefined>> {
  const page = clampInt(Number(searchParams.get("page") ?? "1"), 1, 1_000_000);
  const pageSize = clampInt(
    Number(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE)),
    1,
    MAX_PAGE_SIZE,
  );

  const filters = {} as Record<TFilterKey, string | undefined>;
  for (const key of schema.filterKeys) {
    const v = searchParams.get(key);
    filters[key] = v && v.length > 0 ? v : undefined;
  }

  const qRaw = searchParams.get("q");
  const q = qRaw && qRaw.trim().length > 0 ? qRaw.trim() : null;

  const format = searchParams.get("format") === "csv" ? "csv" : "json";

  return {
    page,
    pageSize,
    sort: parseSort(searchParams.get("sort"), schema),
    q,
    filters,
    format,
  };
}

/** Safely escape a single value for an ILIKE pattern. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Build a PostgREST `.or()` argument for ILIKE search across multiple columns.
 *   buildIlikeOr("foo", ["email", "username"]) -> "email.ilike.%foo%,username.ilike.%foo%"
 */
export function buildIlikeOr(q: string, columns: readonly string[]): string {
  const needle = `%${escapeLike(q)}%`;
  return columns.map((col) => `${col}.ilike.${needle}`).join(",");
}

export interface ListResponse<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  meta?: Record<string, unknown>;
}

export function rangeFor(page: number, pageSize: number): [number, number] {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return [from, to];
}

/** CSV cell escape per RFC 4180. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : JSON.stringify(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(
  rows: Array<Record<string, unknown>>,
  columns: Array<{ key: string; header?: string }>,
): string {
  const header = columns.map((c) => csvCell(c.header ?? c.key)).join(",");
  const body = rows
    .map((row) => columns.map((c) => csvCell(row[c.key])).join(","))
    .join("\r\n");
  return `${header}\r\n${body}`;
}
