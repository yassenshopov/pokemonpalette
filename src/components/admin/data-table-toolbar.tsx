"use client";

import * as React from "react";
import type { Table as TanstackTable } from "@tanstack/react-table";
import {
  Columns3,
  Download,
  RefreshCw,
  Rows3,
  Rows4,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type TableDensity = "comfortable" | "compact";

interface DataTableToolbarProps<TData> {
  table: TanstackTable<TData>;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  /** Filter controls to render inline (left of the overflow menu). */
  filtersSlot?: React.ReactNode;
  /** Whether any filter or search is active — enables the Clear button. */
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  density: TableDensity;
  onDensityChange: (density: TableDensity) => void;
  onRefresh?: () => void;
  onExport?: () => void;
  exportDisabled?: boolean;
  /** Autofocused when `/` is pressed. */
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function DataTableToolbar<TData>({
  table,
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  filtersSlot,
  hasActiveFilters,
  onClearFilters,
  density,
  onDensityChange,
  onRefresh,
  onExport,
  exportDisabled,
  searchInputRef,
}: DataTableToolbarProps<TData>) {
  const [localSearch, setLocalSearch] = React.useState(search);

  React.useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Debounce search input -> URL state.
  React.useEffect(() => {
    if (localSearch === search) return;
    const timeout = setTimeout(() => {
      onSearchChange(localSearch);
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearch]);

  const columns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide());

  const densityIcon = density === "compact" ? Rows4 : Rows3;
  const DensityIcon = densityIcon;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              ref={searchInputRef}
              type="search"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label="Search"
              className="pl-8"
            />
          </div>
          {filtersSlot}
          {hasActiveFilters && onClearFilters ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onClearFilters}
              className="h-9 gap-1"
            >
              <X className="size-4" aria-hidden="true" />
              <span>Clear</span>
            </Button>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          {onRefresh ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={onRefresh}
                  aria-label="Refresh"
                  className="size-9"
                >
                  <RefreshCw className="size-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() =>
                  onDensityChange(
                    density === "compact" ? "comfortable" : "compact",
                  )
                }
                aria-label={
                  density === "compact"
                    ? "Switch to comfortable density"
                    : "Switch to compact density"
                }
                aria-pressed={density === "compact"}
                className="size-9"
              >
                <DensityIcon className="size-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {density === "compact" ? "Comfortable" : "Compact"}
            </TooltipContent>
          </Tooltip>
          {columns.length > 0 ? (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Toggle columns"
                      className="size-9"
                    >
                      <Columns3 className="size-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Columns</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columns.map((column) => {
                  const header = column.columnDef.meta?.label ?? column.id;
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                      onSelect={(e) => e.preventDefault()}
                      className="capitalize"
                    >
                      {header}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {onExport ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={onExport}
                  disabled={exportDisabled}
                  aria-label="Export CSV"
                  className="size-9"
                >
                  <Download className={cn("size-4")} aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export CSV</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}
