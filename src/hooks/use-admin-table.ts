"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ListResponse, SortDir } from "@/lib/admin/query";
import { DEFAULT_PAGE_SIZE } from "@/lib/admin/query";

export type AdminTableFilters = Record<string, string | undefined>;

export interface AdminTableState {
  page: number;
  pageSize: number;
  sort: { field: string; dir: SortDir } | null;
  q: string;
  filters: AdminTableFilters;
}

export interface UseAdminTableOptions<TRow> {
  /** Base endpoint, e.g. "/api/admin/users" */
  endpoint: string;
  /** Filter keys synced to the URL. Unknown params are ignored. */
  filterKeys: readonly string[];
  /** Allowed sort fields (others are ignored). */
  sortableFields: readonly string[];
  /** Optional default sort applied when the URL has none. */
  defaultSort?: { field: string; dir: SortDir };
  /** Optional default page size. */
  defaultPageSize?: number;
  /** Any additional fixed query params (e.g. view=attempts). */
  extraParams?: Record<string, string | undefined>;
  /** Extract the ID for React row keys and selection. */
  getRowId: (row: TRow) => string;
}

export interface UseAdminTableResult<TRow> {
  state: AdminTableState;
  rows: TRow[];
  total: number;
  loading: boolean;
  error: string | null;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setSort: (sort: AdminTableState["sort"]) => void;
  setSearch: (q: string) => void;
  setFilter: (key: string, value: string | undefined) => void;
  setFilters: (filters: AdminTableFilters) => void;
  clearFilters: () => void;
  refetch: () => void;
  selection: Set<string>;
  setSelection: (next: Set<string>) => void;
  toggleSelected: (id: string) => void;
  selectAllOnPage: () => void;
  clearSelection: () => void;
  /** The serialized query string currently in the URL (without the leading ?). */
  queryString: string;
}

function buildQueryString(
  state: AdminTableState,
  extra: Record<string, string | undefined> = {},
): string {
  const params = new URLSearchParams();
  if (state.page > 1) params.set("page", String(state.page));
  if (state.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set("pageSize", String(state.pageSize));
  }
  if (state.sort) params.set("sort", `${state.sort.field}:${state.sort.dir}`);
  if (state.q) params.set("q", state.q);
  for (const [k, v] of Object.entries(state.filters)) {
    if (v && v.length > 0) params.set(k, v);
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v && v.length > 0) params.set(k, v);
  }
  return params.toString();
}

export function useAdminTable<TRow>({
  endpoint,
  filterKeys,
  sortableFields,
  defaultSort,
  defaultPageSize = DEFAULT_PAGE_SIZE,
  extraParams,
  getRowId,
}: UseAdminTableOptions<TRow>): UseAdminTableResult<TRow> {
  const router = useRouter();
  const urlSearchParams = useSearchParams();

  // Derive state from the URL — URL is the source of truth.
  const state = useMemo<AdminTableState>(() => {
    const params = urlSearchParams ?? new URLSearchParams();
    const pageRaw = Number(params.get("page") ?? "1");
    const pageSizeRaw = Number(params.get("pageSize") ?? String(defaultPageSize));
    const sortRaw = params.get("sort");
    let sort: AdminTableState["sort"] = defaultSort ?? null;
    if (sortRaw) {
      const [field, dir] = sortRaw.split(":");
      if (field && sortableFields.includes(field)) {
        sort = { field, dir: dir === "asc" ? "asc" : "desc" };
      }
    }
    const filters: AdminTableFilters = {};
    for (const key of filterKeys) {
      const v = params.get(key);
      if (v && v.length > 0) filters[key] = v;
    }
    return {
      page: Number.isFinite(pageRaw) ? Math.max(1, Math.trunc(pageRaw)) : 1,
      pageSize: Number.isFinite(pageSizeRaw)
        ? Math.max(1, Math.min(200, Math.trunc(pageSizeRaw)))
        : defaultPageSize,
      sort,
      q: params.get("q") ?? "",
      filters,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearchParams]);

  const [rows, setRows] = useState<TRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [refreshToken, setRefreshToken] = useState(0);

  const queryString = useMemo(
    () => buildQueryString(state, extraParams ?? {}),
    [state, extraParams],
  );

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    const url = `${endpoint}${queryString ? `?${queryString}` : ""}`;
    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          let message = `Failed to load (${res.status})`;
          try {
            const data = await res.json();
            if (data?.error && typeof data.error === "string") {
              message = data.error;
            }
          } catch {
            // ignore body parse error
          }
          throw new Error(message);
        }
        return (await res.json()) as ListResponse<TRow>;
      })
      .then((data) => {
        setRows(data.rows ?? []);
        setTotal(Number.isFinite(data.total) ? data.total : 0);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return;
        console.error("useAdminTable fetch error", err);
        setError((err as Error).message || "Failed to load data.");
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [endpoint, queryString, refreshToken]);

  // Reset selection when the result set changes identity.
  useEffect(() => {
    setSelection(new Set());
  }, [queryString]);

  const pushState = useCallback(
    (next: AdminTableState) => {
      const qs = buildQueryString(next, extraParams ?? {});
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router, extraParams],
  );

  const setPage = useCallback(
    (page: number) => pushState({ ...state, page: Math.max(1, page) }),
    [state, pushState],
  );
  const setPageSize = useCallback(
    (size: number) =>
      pushState({ ...state, pageSize: Math.max(1, size), page: 1 }),
    [state, pushState],
  );
  const setSort = useCallback(
    (sort: AdminTableState["sort"]) =>
      pushState({ ...state, sort, page: 1 }),
    [state, pushState],
  );
  const setSearch = useCallback(
    (q: string) => pushState({ ...state, q, page: 1 }),
    [state, pushState],
  );
  const setFilter = useCallback(
    (key: string, value: string | undefined) => {
      const filters = { ...state.filters };
      if (value && value.length > 0) filters[key] = value;
      else delete filters[key];
      pushState({ ...state, filters, page: 1 });
    },
    [state, pushState],
  );
  const setFilters = useCallback(
    (filters: AdminTableFilters) =>
      pushState({ ...state, filters, page: 1 }),
    [state, pushState],
  );
  const clearFilters = useCallback(
    () => pushState({ ...state, filters: {}, q: "", page: 1 }),
    [state, pushState],
  );

  const refetch = useCallback(() => setRefreshToken((n) => n + 1), []);

  const toggleSelected = useCallback((id: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllOnPage = useCallback(() => {
    setSelection((prev) => {
      const ids = rows.map(getRowId);
      const allSelected = ids.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, [rows, getRowId]);

  const clearSelection = useCallback(() => setSelection(new Set()), []);

  return {
    state,
    rows,
    total,
    loading,
    error,
    setPage,
    setPageSize,
    setSort,
    setSearch,
    setFilter,
    setFilters,
    clearFilters,
    refetch,
    selection,
    setSelection,
    toggleSelected,
    selectAllOnPage,
    clearSelection,
    queryString,
  };
}
