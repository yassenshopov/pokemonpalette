"use client";

import * as React from "react";
import Image from "next/image";
import { Filter, Search, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import type { PokemonColorRow, Variant } from "./types";

interface PokemonPickerProps {
  pokemon: PokemonColorRow[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  variant: Variant;
}

const numberFormat = new Intl.NumberFormat();

type FilterState = {
  minId: string;
  maxId: string;
  onlyWithSprite: boolean;
  onlyUnsaved: boolean;
};

const EMPTY_FILTER: FilterState = {
  minId: "",
  maxId: "",
  onlyWithSprite: false,
  onlyUnsaved: false,
};

function statusForRow(row: PokemonColorRow, variant: Variant): {
  tone: "ok" | "default" | "warn" | "missing";
  label: string;
} {
  const sprite = variant === "shiny" ? row.shinySpriteUrl : row.spriteUrl;
  const colors =
    variant === "shiny" ? row.staticShinyColors : row.staticColors;
  if (!sprite) return { tone: "missing", label: "No sprite available" };
  if (colors.length === 0)
    return { tone: "warn", label: "Using defaults — no stored palette" };
  if (colors.length < 6)
    return { tone: "default", label: `Partial palette (${colors.length}/6)` };
  return { tone: "ok", label: "Full palette stored" };
}

function filterPokemon(
  list: PokemonColorRow[],
  query: string,
  filters: FilterState,
  variant: Variant,
): PokemonColorRow[] {
  const q = query.trim().toLowerCase().replace(/^#/, "");
  const min = filters.minId === "" ? null : Number(filters.minId);
  const max = filters.maxId === "" ? null : Number(filters.maxId);
  return list.filter((p) => {
    if (q) {
      const nameMatch = p.name.toLowerCase().includes(q);
      const idMatch = String(p.id).includes(q);
      if (!nameMatch && !idMatch) return false;
    }
    if (min !== null && !Number.isNaN(min) && p.id < min) return false;
    if (max !== null && !Number.isNaN(max) && p.id > max) return false;
    if (filters.onlyWithSprite) {
      const sprite = variant === "shiny" ? p.shinySpriteUrl : p.spriteUrl;
      if (!sprite) return false;
    }
    if (filters.onlyUnsaved) {
      const colors =
        variant === "shiny" ? p.staticShinyColors : p.staticColors;
      if (colors.length >= 6) return false;
    }
    return true;
  });
}

export function PokemonPicker({
  pokemon,
  selectedId,
  onSelect,
  variant,
}: PokemonPickerProps) {
  const [query, setQuery] = React.useState("");
  const [filters, setFilters] = React.useState<FilterState>(EMPTY_FILTER);
  const [filterOpen, setFilterOpen] = React.useState(false);

  const listRef = React.useRef<HTMLUListElement | null>(null);

  const filtered = React.useMemo(
    () => filterPokemon(pokemon, query, filters, variant),
    [pokemon, query, filters, variant],
  );

  const activeFilterCount =
    (filters.minId ? 1 : 0) +
    (filters.maxId ? 1 : 0) +
    (filters.onlyWithSprite ? 1 : 0) +
    (filters.onlyUnsaved ? 1 : 0);

  // Scroll the selected row into view when it changes from outside (e.g.
  // URL deep-link) so the admin isn't hunting through 1000+ rows.
  React.useEffect(() => {
    if (selectedId === null || !listRef.current) return;
    const node = listRef.current.querySelector<HTMLElement>(
      `[data-pokemon-id="${selectedId}"]`,
    );
    if (node) {
      node.scrollIntoView({ block: "nearest" });
    }
  }, [selectedId]);

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLUListElement>,
    currentId: number,
  ) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const idx = filtered.findIndex((p) => p.id === currentId);
    if (idx === -1) return;
    const nextIdx = e.key === "ArrowDown" ? idx + 1 : idx - 1;
    const next = filtered[nextIdx];
    if (next) {
      onSelect(next.id);
    }
  };

  return (
    <aside
      // On desktop the picker stays pinned under the admin header while the
      // editor column scrolls the page normally. The `100dvh` unit accounts
      // for mobile URL bars, and `top-14` matches `AdminPageHeader`'s height.
      className="flex min-h-0 w-full flex-col border-b bg-card lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:w-[340px] lg:shrink-0 lg:self-start lg:border-b-0 lg:border-r"
      aria-label="Pokémon picker"
    >
      <div className="flex flex-col gap-2 border-b p-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="color-picker-search"
            type="search"
            inputMode="search"
            spellCheck={false}
            autoComplete="off"
            placeholder="Search name or ID, e.g. pikachu or 25…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 pr-9"
            aria-label="Search Pokémon by name or ID"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Clear search"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-2">
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                aria-label={`Filters${activeFilterCount ? ` (${activeFilterCount} active)` : ""}`}
              >
                <Filter className="size-3.5" aria-hidden="true" />
                Filters
                {activeFilterCount > 0 ? (
                  <Badge
                    variant="secondary"
                    className="h-4 px-1 text-[10px] tabular-nums"
                  >
                    {activeFilterCount}
                  </Badge>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 space-y-3">
              <div className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  ID range
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    aria-label="Minimum Pokémon ID"
                    type="number"
                    inputMode="numeric"
                    placeholder="Min"
                    value={filters.minId}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, minId: e.target.value }))
                    }
                    className="h-8 tabular-nums"
                    min="1"
                  />
                  <span aria-hidden="true" className="text-muted-foreground">
                    –
                  </span>
                  <Input
                    aria-label="Maximum Pokémon ID"
                    type="number"
                    inputMode="numeric"
                    placeholder="Max"
                    value={filters.maxId}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, maxId: e.target.value }))
                    }
                    className="h-8 tabular-nums"
                    min="1"
                  />
                </div>
              </div>
              <Separator />
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.onlyWithSprite}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      onlyWithSprite: e.target.checked,
                    }))
                  }
                  className="size-4 rounded border-input"
                />
                Only Pokémon with a {variant === "shiny" ? "shiny " : ""}
                sprite
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.onlyUnsaved}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      onlyUnsaved: e.target.checked,
                    }))
                  }
                  className="size-4 rounded border-input"
                />
                Only partial / missing palettes
              </label>
              <div className="flex items-center justify-between pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setFilters(EMPTY_FILTER)}
                  disabled={activeFilterCount === 0}
                >
                  Clear all
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setFilterOpen(false)}
                >
                  Done
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <span
            className="text-xs tabular-nums text-muted-foreground"
            aria-live="polite"
          >
            {numberFormat.format(filtered.length)} of{" "}
            {numberFormat.format(pokemon.length)}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
            No Pokémon match that search.
          </div>
        ) : (
          <ul
            ref={listRef}
            role="listbox"
            aria-label="Pokémon results"
            aria-activedescendant={
              selectedId !== null ? `pokemon-row-${selectedId}` : undefined
            }
            className="py-1"
            tabIndex={-1}
          >
            {filtered.map((row) => (
              <PickerRow
                key={row.id}
                row={row}
                variant={variant}
                selected={row.id === selectedId}
                onSelect={() => onSelect(row.id)}
                onKeyDown={(e) => handleKeyDown(e, row.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

interface PickerRowProps {
  row: PokemonColorRow;
  variant: Variant;
  selected: boolean;
  onSelect: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLUListElement>) => void;
}

function PickerRow({
  row,
  variant,
  selected,
  onSelect,
  onKeyDown,
}: PickerRowProps) {
  const sprite = variant === "shiny" ? row.shinySpriteUrl : row.spriteUrl;
  const colors = variant === "shiny" ? row.staticShinyColors : row.staticColors;
  const status = statusForRow(row, variant);

  return (
    <li
      id={`pokemon-row-${row.id}`}
      data-pokemon-id={row.id}
      role="option"
      aria-selected={selected}
      // `content-visibility: auto` lets the browser skip offscreen rows —
      // this is the cheap replacement for a virtualization library for
      // the ~1000-row picker (guideline: virtualize large lists).
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: "56px",
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            onKeyDown(
              e as unknown as React.KeyboardEvent<HTMLUListElement>,
            );
          }
        }}
        className={cn(
          "group flex w-full items-center gap-2.5 px-3 py-2 text-left",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          "hover:bg-muted/60",
          selected && "bg-muted",
        )}
        aria-label={`${row.name}, number ${row.id}. ${status.label}.`}
        style={{ touchAction: "manipulation" }}
      >
        <div className="relative flex size-10 shrink-0 items-center justify-center rounded-md bg-muted/40">
          {sprite ? (
            <Image
              src={sprite}
              alt=""
              width={40}
              height={40}
              className="size-10 object-contain"
              style={{ imageRendering: "pixelated" }}
              unoptimized
              loading="lazy"
            />
          ) : (
            <span className="text-[10px] text-muted-foreground">N/A</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className="min-w-0 truncate text-sm font-medium capitalize"
              translate="no"
            >
              {row.name}
            </span>
            <span
              className="font-mono text-[10px] tabular-nums text-muted-foreground"
              translate="no"
            >
              #{row.id}
            </span>
            {variant === "shiny" ? (
              <Sparkles
                className="size-3 text-amber-500"
                aria-label="Shiny variant"
              />
            ) : null}
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <MiniPalette colors={colors} />
            <StatusDot tone={status.tone} label={status.label} />
          </div>
        </div>
      </button>
    </li>
  );
}

function MiniPalette({ colors }: { colors: string[] }) {
  const padded = [...colors];
  while (padded.length < 6) padded.push("");
  return (
    <div
      aria-hidden="true"
      className="flex h-3 overflow-hidden rounded-sm border"
      style={{ width: "60px" }}
    >
      {padded.slice(0, 6).map((hex, i) => (
        <span
          key={i}
          className="h-full"
          style={{
            width: "10px",
            backgroundColor: hex || "transparent",
            backgroundImage: hex
              ? undefined
              : "repeating-linear-gradient(45deg,var(--muted) 0 2px,transparent 2px 4px)",
          }}
        />
      ))}
    </div>
  );
}

function StatusDot({
  tone,
  label,
}: {
  tone: "ok" | "default" | "warn" | "missing";
  label: string;
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-500"
      : tone === "warn"
        ? "bg-amber-500"
        : tone === "missing"
          ? "bg-rose-500"
          : "bg-muted-foreground/50";
  return (
    <span
      className={cn("size-1.5 shrink-0 rounded-full", cls)}
      role="img"
      aria-label={label}
      title={label}
    />
  );
}
