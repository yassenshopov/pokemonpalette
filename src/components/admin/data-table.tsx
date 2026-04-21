"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminPagination } from "@/components/admin/admin-pagination";
import {
  BulkActionBar,
  type BulkAction,
} from "@/components/admin/bulk-action-bar";
import {
  RowActions,
  type RowAction,
} from "@/components/admin/row-actions";
import {
  DataTableToolbar,
  type TableDensity,
} from "@/components/admin/data-table-toolbar";
import type { UseAdminTableResult } from "@/hooks/use-admin-table";
import { cn } from "@/lib/utils";

// Extend TanStack column meta with a label + align.
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    label?: string;
    align?: "left" | "right" | "center";
    /** Hide the column via column visibility by default. */
    defaultHidden?: boolean;
    /** If true, the column is sortable server-side on this field id. */
    sortField?: string;
    className?: string;
  }
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200] as const;

const DENSITY_CELL: Record<TableDensity, string> = {
  comfortable: "py-3",
  compact: "py-1.5 text-[13px]",
};

export interface DataTableProps<TData> {
  table: UseAdminTableResult<TData>;
  columns: ColumnDef<TData, unknown>[];
  getRowId: (row: TData) => string;
  resourceLabel: string;
  searchPlaceholder?: string;
  filtersSlot?: React.ReactNode;
  rowActions?: (row: TData) => RowAction[];
  bulkActions?: BulkAction[];
  onRowClick?: (row: TData) => void;
  /** Stable key used to persist density & column visibility in localStorage. */
  storageKey: string;
  /** Enables CSV export. Must match the API endpoint (will fetch `?format=csv`). */
  exportEndpoint?: string;
  exportFilename?: string;
  emptyMessage?: string;
  /** Optional fixed query params appended to export URL (e.g. view=attempts). */
  exportParams?: Record<string, string | undefined>;
}

function loadPref<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function savePref(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

export function DataTable<TData>({
  table,
  columns,
  getRowId,
  resourceLabel,
  searchPlaceholder,
  filtersSlot,
  rowActions,
  bulkActions,
  onRowClick,
  storageKey,
  exportEndpoint,
  exportFilename,
  exportParams,
  emptyMessage,
}: DataTableProps<TData>) {
  const {
    state,
    rows,
    total,
    loading,
    error,
    setPage,
    setPageSize,
    setSort,
    setSearch,
    clearFilters,
    refetch,
    selection,
    toggleSelected,
    selectAllOnPage,
    clearSelection,
  } = table;

  const [density, setDensity] = React.useState<TableDensity>(() =>
    loadPref<TableDensity>(`${storageKey}:density`, "comfortable"),
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(() => {
      const initial: VisibilityState = {};
      for (const col of columns) {
        if (col.meta?.defaultHidden && col.id) {
          initial[col.id] = false;
        }
      }
      return {
        ...initial,
        ...loadPref<VisibilityState>(`${storageKey}:visibility`, {}),
      };
    });
  const [exporting, setExporting] = React.useState(false);

  React.useEffect(() => {
    savePref(`${storageKey}:density`, density);
  }, [density, storageKey]);

  React.useEffect(() => {
    savePref(`${storageKey}:visibility`, columnVisibility);
  }, [columnVisibility, storageKey]);

  // Build the decorated column list: selection + user columns + actions.
  const decoratedColumns = React.useMemo<ColumnDef<TData, unknown>[]>(() => {
    const selectionCol: ColumnDef<TData, unknown> | null = bulkActions
      ? {
          id: "__select",
          header: () => {
            const pageIds = rows.map(getRowId);
            const allSelected =
              pageIds.length > 0 && pageIds.every((id) => selection.has(id));
            const someSelected =
              pageIds.some((id) => selection.has(id)) && !allSelected;
            return (
              <Checkbox
                checked={
                  allSelected ? true : someSelected ? "indeterminate" : false
                }
                onCheckedChange={() => selectAllOnPage()}
                aria-label={allSelected ? "Deselect all" : "Select all"}
                onClick={(e) => e.stopPropagation()}
              />
            );
          },
          cell: ({ row }) => {
            const id = getRowId(row.original);
            return (
              <Checkbox
                checked={selection.has(id)}
                onCheckedChange={() => toggleSelected(id)}
                aria-label={`Select row ${id}`}
                onClick={(e) => e.stopPropagation()}
              />
            );
          },
          size: 32,
          enableHiding: false,
          meta: { label: "Select" },
        }
      : null;

    const actionsCol: ColumnDef<TData, unknown> | null = rowActions
      ? {
          id: "__actions",
          header: () => <span className="sr-only">Actions</span>,
          cell: ({ row }) => {
            const actions = rowActions(row.original);
            if (actions.length === 0) return null;
            return <RowActions actions={actions} />;
          },
          size: 40,
          enableHiding: false,
          meta: { label: "Actions", align: "right" },
        }
      : null;

    const result: ColumnDef<TData, unknown>[] = [];
    if (selectionCol) result.push(selectionCol);
    result.push(...columns);
    if (actionsCol) result.push(actionsCol);
    return result;
  }, [
    columns,
    bulkActions,
    rowActions,
    rows,
    selection,
    getRowId,
    selectAllOnPage,
    toggleSelected,
  ]);

  const tanstack = useReactTable({
    data: rows,
    columns: decoratedColumns,
    state: {
      columnVisibility,
    },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    getRowId: (row) => getRowId(row),
  });

  const pageCount = Math.max(1, Math.ceil(total / state.pageSize));
  const safePage = Math.min(Math.max(1, state.page), pageCount);
  const firstShown = total === 0 ? 0 : (safePage - 1) * state.pageSize + 1;
  const lastShown = Math.min(safePage * state.pageSize, total);

  const searchInputRef = React.useRef<HTMLInputElement | null>(null);

  // "/" focuses the search input (unless already typing in a field).
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hasActiveFilters = React.useMemo(() => {
    if (state.q && state.q.length > 0) return true;
    return Object.values(state.filters).some((v) => v && v.length > 0);
  }, [state.q, state.filters]);

  const handleExport = async () => {
    if (!exportEndpoint) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (state.sort) {
        params.set("sort", `${state.sort.field}:${state.sort.dir}`);
      }
      if (state.q) params.set("q", state.q);
      for (const [k, v] of Object.entries(state.filters)) {
        if (v) params.set(k, v);
      }
      for (const [k, v] of Object.entries(exportParams ?? {})) {
        if (v) params.set(k, v);
      }
      params.set("format", "csv");
      const res = await fetch(`${exportEndpoint}?${params.toString()}`);
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportFilename ?? resourceLabel}-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setExporting(false);
    }
  };

  const selectedIds = React.useMemo(
    () => Array.from(selection),
    [selection],
  );

  const columnCount = tanstack.getVisibleLeafColumns().length;

  return (
    <div className="space-y-3">
      <DataTableToolbar
        table={tanstack}
        search={state.q}
        onSearchChange={setSearch}
        searchPlaceholder={searchPlaceholder}
        filtersSlot={filtersSlot}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        density={density}
        onDensityChange={setDensity}
        onRefresh={refetch}
        onExport={exportEndpoint ? handleExport : undefined}
        exportDisabled={exporting || total === 0}
        searchInputRef={searchInputRef}
      />

      {bulkActions && selection.size > 0 ? (
        <BulkActionBar
          selectedCount={selection.size}
          totalOnPage={rows.length}
          actions={bulkActions}
          onClear={clearSelection}
          selectedIds={selectedIds}
        />
      ) : null}

      {error ? (
        <Card role="alert" aria-live="polite">
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <span className="text-sm text-destructive">{error}</span>
            <Button type="button" size="sm" variant="outline" onClick={refetch}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 z-[1] bg-background">
                {tanstack.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const meta = header.column.columnDef.meta;
                      const sortField = meta?.sortField;
                      const isSorted =
                        sortField && state.sort?.field === sortField
                          ? state.sort.dir
                          : false;
                      const align = meta?.align ?? "left";
                      return (
                        <TableHead
                          key={header.id}
                          className={cn(
                            align === "right" && "text-right",
                            align === "center" && "text-center",
                            meta?.className,
                          )}
                          style={
                            header.column.getSize() !== 150
                              ? { width: header.column.getSize() }
                              : undefined
                          }
                          aria-sort={
                            sortField
                              ? isSorted === "asc"
                                ? "ascending"
                                : isSorted === "desc"
                                  ? "descending"
                                  : "none"
                              : undefined
                          }
                        >
                          {header.isPlaceholder ? null : sortField ? (
                            <button
                              type="button"
                              onClick={() => {
                                const nextDir =
                                  isSorted === "asc" ? "desc" : "asc";
                                setSort({ field: sortField, dir: nextDir });
                              }}
                              className={cn(
                                "inline-flex items-center gap-1 font-medium hover:text-foreground focus-visible:outline-none focus-visible:underline",
                                align === "right" && "ml-auto",
                              )}
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                              {isSorted === "asc" ? (
                                <ArrowUp
                                  className="size-3.5"
                                  aria-hidden="true"
                                />
                              ) : isSorted === "desc" ? (
                                <ArrowDown
                                  className="size-3.5"
                                  aria-hidden="true"
                                />
                              ) : (
                                <ArrowUpDown
                                  className="size-3.5 text-muted-foreground"
                                  aria-hidden="true"
                                />
                              )}
                            </button>
                          ) : (
                            flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )
                          )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: Math.min(state.pageSize, 6) }).map(
                    (_, i) => (
                      <TableRow key={`skeleton-${i}`}>
                        {tanstack.getVisibleLeafColumns().map((col) => (
                          <TableCell
                            key={col.id}
                            className={cn(DENSITY_CELL[density])}
                          >
                            <Skeleton className="h-4 w-full max-w-[120px]" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ),
                  )
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columnCount}
                      className="py-12 text-center text-sm text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span>{emptyMessage ?? `No ${resourceLabel} found.`}</span>
                        {hasActiveFilters ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={clearFilters}
                          >
                            Clear filters
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  tanstack.getRowModel().rows.map((row) => {
                    const id = getRowId(row.original);
                    const isSelected = selection.has(id);
                    const clickable = Boolean(onRowClick);
                    return (
                      <TableRow
                        key={row.id}
                        data-state={isSelected ? "selected" : undefined}
                        role={clickable ? "button" : undefined}
                        tabIndex={clickable ? 0 : undefined}
                        aria-label={
                          clickable ? `Open ${resourceLabel} details` : undefined
                        }
                        onClick={clickable ? () => onRowClick!(row.original) : undefined}
                        onKeyDown={
                          clickable
                            ? (e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  onRowClick!(row.original);
                                }
                              }
                            : undefined
                        }
                        className={cn(
                          clickable &&
                            "cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none",
                          isSelected && "bg-muted/50",
                        )}
                      >
                        {row.getVisibleCells().map((cell) => {
                          const meta = cell.column.columnDef.meta;
                          const align = meta?.align ?? "left";
                          return (
                            <TableCell
                              key={cell.id}
                              className={cn(
                                DENSITY_CELL[density],
                                align === "right" && "text-right",
                                align === "center" && "text-center",
                                meta?.className,
                              )}
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col items-start justify-between gap-3 border-t px-4 py-3 sm:flex-row sm:items-center">
            <div
              className="text-sm text-muted-foreground tabular-nums"
              aria-live="polite"
            >
              {loading
                ? `Loading ${resourceLabel}…`
                : total === 0
                  ? `No ${resourceLabel}`
                  : `Showing ${firstShown.toLocaleString()}–${lastShown.toLocaleString()} of ${total.toLocaleString()} · Page ${safePage} of ${pageCount}`}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label
                  htmlFor={`${storageKey}-page-size`}
                  className="text-sm text-muted-foreground"
                >
                  Show
                </label>
                <Select
                  value={String(state.pageSize)}
                  onValueChange={(v) => setPageSize(Number(v))}
                >
                  <SelectTrigger
                    id={`${storageKey}-page-size`}
                    className="h-9 w-[100px]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={String(opt)}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {pageCount > 1 ? (
                <AdminPagination
                  page={safePage}
                  totalPages={pageCount}
                  onPageChange={setPage}
                />
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export type { ColumnDef } from "@tanstack/react-table";
