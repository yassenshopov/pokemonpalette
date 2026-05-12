"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronRight, Filter, Search, Sparkles, X } from "lucide-react";
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
import type { PokemonColorRow, Variant, VarietyKind } from "./types";

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

const VARIETY_KIND_LABEL: Record<VarietyKind, string> = {
  mega: "Mega",
  gigantamax: "G-Max",
  alolan: "Alolan",
  galarian: "Galarian",
  hisuian: "Hisuian",
  paldean: "Paldean",
  form: "Form",
};

/** Tailwind classes per variety kind. The picker uses a coloured pill so an
 * admin can scan a long list and immediately spot what kind of alt form
 * they're looking at. */
const VARIETY_KIND_BADGE: Record<VarietyKind, string> = {
  mega: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
  gigantamax: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  alolan: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  galarian: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  hisuian: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  paldean: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  form: "bg-muted text-muted-foreground",
};

function rowSprite(row: PokemonColorRow, variant: Variant): string | null {
  return variant === "shiny" ? row.shinySpriteUrl : row.spriteUrl;
}

function rowColors(row: PokemonColorRow, variant: Variant): string[] {
  return variant === "shiny" ? row.staticShinyColors : row.staticColors;
}

function statusForRow(
  row: PokemonColorRow,
  variant: Variant,
): {
  tone: "ok" | "default" | "warn" | "missing";
  label: string;
} {
  const sprite = rowSprite(row, variant);
  const colors = rowColors(row, variant);
  if (!sprite) return { tone: "missing", label: "No sprite available" };
  if (colors.length === 0)
    return { tone: "warn", label: "Using defaults — no stored palette" };
  if (colors.length < 6)
    return { tone: "default", label: `Partial palette (${colors.length}/6)` };
  return { tone: "ok", label: "Full palette stored" };
}

function rowMatchesQuery(row: PokemonColorRow, q: string): boolean {
  if (!q) return true;
  return (
    row.name.toLowerCase().includes(q) || String(row.id).includes(q)
  );
}

function rowMatchesFilters(
  row: PokemonColorRow,
  filters: FilterState,
  variant: Variant,
): boolean {
  const min = filters.minId === "" ? null : Number(filters.minId);
  const max = filters.maxId === "" ? null : Number(filters.maxId);
  if (min !== null && !Number.isNaN(min) && row.id < min) return false;
  if (max !== null && !Number.isNaN(max) && row.id > max) return false;
  if (filters.onlyWithSprite && !rowSprite(row, variant)) return false;
  if (filters.onlyUnsaved) {
    const colors = rowColors(row, variant);
    if (colors.length >= 6) return false;
  }
  return true;
}

interface VisibleSpecies {
  species: PokemonColorRow;
  varieties: PokemonColorRow[];
  /** When true, the variety list was reduced by an active search/filter and
   * the species should render as expanded regardless of the user's manual
   * collapse state — otherwise the matching alt form would be hidden. */
  forceExpanded: boolean;
}

/** Compute which species + varieties are visible given the current search,
 * filters, and (for default expansion) the manually expanded ids. We do
 * this once per change instead of in render so the row map stays stable. */
function buildVisible(
  list: PokemonColorRow[],
  query: string,
  filters: FilterState,
  variant: Variant,
): VisibleSpecies[] {
  const q = query.trim().toLowerCase().replace(/^#/, "");
  const out: VisibleSpecies[] = [];
  const filtering =
    q.length > 0 ||
    filters.minId !== "" ||
    filters.maxId !== "" ||
    filters.onlyWithSprite ||
    filters.onlyUnsaved;

  for (const species of list) {
    const speciesPasses =
      rowMatchesQuery(species, q) && rowMatchesFilters(species, filters, variant);
    const varieties = species.varieties ?? [];
    const matchingVarieties = varieties.filter(
      (v) => rowMatchesQuery(v, q) && rowMatchesFilters(v, filters, variant),
    );
    const includeSpecies = speciesPasses || matchingVarieties.length > 0;
    if (!includeSpecies) continue;

    if (filtering) {
      // When filtering, we want the UI to reveal exactly why this species
      // is in the list. Show only matching varieties; if the species
      // matched but no varieties did, leave varieties hidden (they'll
      // come back when the admin clears the search).
      out.push({
        species,
        varieties: speciesPasses ? matchingVarieties : matchingVarieties,
        forceExpanded: matchingVarieties.length > 0,
      });
    } else {
      out.push({
        species,
        varieties,
        forceExpanded: false,
      });
    }
  }
  return out;
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
  // Manually expanded species ids. Persisted in component state only —
  // refreshing the page collapses everything back to species, which keeps
  // the picker tidy by default for the common case.
  const [expandedIds, setExpandedIds] = React.useState<Set<number>>(
    () => new Set(),
  );

  const listRef = React.useRef<HTMLUListElement | null>(null);

  const visibleSpecies = React.useMemo(
    () => buildVisible(pokemon, query, filters, variant),
    [pokemon, query, filters, variant],
  );

  // Flatten the visible tree into a single array of "render rows" so
  // keyboard navigation and the rendered list share one source of truth.
  type RenderRow =
    | { kind: "species"; row: PokemonColorRow; expanded: boolean; canExpand: boolean }
    | { kind: "variety"; row: PokemonColorRow };

  const renderRows = React.useMemo<RenderRow[]>(() => {
    const rows: RenderRow[] = [];
    for (const entry of visibleSpecies) {
      const canExpand = (entry.species.varieties?.length ?? 0) > 0;
      const expanded =
        entry.forceExpanded || expandedIds.has(entry.species.id);
      rows.push({
        kind: "species",
        row: entry.species,
        expanded,
        canExpand,
      });
      if (expanded) {
        for (const v of entry.varieties) {
          rows.push({ kind: "variety", row: v });
        }
      }
    }
    return rows;
  }, [visibleSpecies, expandedIds]);

  const totalCount = React.useMemo(() => {
    let n = pokemon.length;
    for (const species of pokemon) n += species.varieties?.length ?? 0;
    return n;
  }, [pokemon]);

  const visibleCount = React.useMemo(() => {
    let n = 0;
    for (const entry of visibleSpecies) {
      n += 1 + entry.varieties.length;
    }
    return n;
  }, [visibleSpecies]);

  const activeFilterCount =
    (filters.minId ? 1 : 0) +
    (filters.maxId ? 1 : 0) +
    (filters.onlyWithSprite ? 1 : 0) +
    (filters.onlyUnsaved ? 1 : 0);

  // When the parent picks a row that lives under a species (e.g. a deep
  // link to ?id=10034), make sure the species above it is expanded so the
  // selected row is actually visible in the list.
  React.useEffect(() => {
    if (selectedId === null) return;
    const parent = pokemon.find((s) =>
      s.varieties?.some((v) => v.id === selectedId),
    );
    if (parent && !expandedIds.has(parent.id)) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.add(parent.id);
        return next;
      });
    }
  }, [selectedId, pokemon, expandedIds]);

  // Scroll the selected row into view when it changes from outside (e.g.
  // URL deep-link) so the admin isn't hunting through 1300+ rows.
  React.useEffect(() => {
    if (selectedId === null || !listRef.current) return;
    const node = listRef.current.querySelector<HTMLElement>(
      `[data-pokemon-id="${selectedId}"]`,
    );
    if (node) {
      node.scrollIntoView({ block: "nearest" });
    }
  }, [selectedId, renderRows]);

  const toggleExpanded = React.useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLUListElement>,
    currentId: number,
  ) => {
    if (
      e.key !== "ArrowDown" &&
      e.key !== "ArrowUp" &&
      e.key !== "ArrowRight" &&
      e.key !== "ArrowLeft"
    ) {
      return;
    }

    const idx = renderRows.findIndex((r) => r.row.id === currentId);
    if (idx === -1) return;

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const nextIdx = e.key === "ArrowDown" ? idx + 1 : idx - 1;
      const next = renderRows[nextIdx];
      if (next) onSelect(next.row.id);
      return;
    }

    // Right/Left expand or collapse the current species. Mirrors the
    // standard ARIA tree pattern so admins comfortable with file pickers
    // can navigate quickly.
    const current = renderRows[idx];
    if (!current || current.kind !== "species" || !current.canExpand) return;
    e.preventDefault();
    if (e.key === "ArrowRight" && !current.expanded) {
      toggleExpanded(current.row.id);
    } else if (e.key === "ArrowLeft" && current.expanded) {
      toggleExpanded(current.row.id);
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
            placeholder="Search name or ID, e.g. pikachu, mega, 25…"
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
            {numberFormat.format(visibleCount)} of{" "}
            {numberFormat.format(totalCount)}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {renderRows.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
            No Pokémon match that search.
          </div>
        ) : (
          <ul
            ref={listRef}
            role="tree"
            aria-label="Pokémon results"
            aria-activedescendant={
              selectedId !== null ? `pokemon-row-${selectedId}` : undefined
            }
            className="py-1"
            tabIndex={-1}
          >
            {renderRows.map((entry) =>
              entry.kind === "species" ? (
                <SpeciesRow
                  key={`species-${entry.row.id}`}
                  row={entry.row}
                  variant={variant}
                  selected={entry.row.id === selectedId}
                  expanded={entry.expanded}
                  canExpand={entry.canExpand}
                  onSelect={() => onSelect(entry.row.id)}
                  onToggleExpand={() => toggleExpanded(entry.row.id)}
                  onKeyDown={(e) => handleKeyDown(e, entry.row.id)}
                />
              ) : (
                <VarietyRow
                  key={`variety-${entry.row.id}`}
                  row={entry.row}
                  variant={variant}
                  selected={entry.row.id === selectedId}
                  onSelect={() => onSelect(entry.row.id)}
                  onKeyDown={(e) => handleKeyDown(e, entry.row.id)}
                />
              ),
            )}
          </ul>
        )}
      </div>
    </aside>
  );
}

interface SpeciesRowProps {
  row: PokemonColorRow;
  variant: Variant;
  selected: boolean;
  expanded: boolean;
  canExpand: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLUListElement>) => void;
}

function SpeciesRow({
  row,
  variant,
  selected,
  expanded,
  canExpand,
  onSelect,
  onToggleExpand,
  onKeyDown,
}: SpeciesRowProps) {
  const sprite = variant === "shiny" ? row.shinySpriteUrl : row.spriteUrl;
  const colors = variant === "shiny" ? row.staticShinyColors : row.staticColors;
  const status = statusForRow(row, variant);
  const altCount = row.varieties?.length ?? 0;

  return (
    <li
      id={`pokemon-row-${row.id}`}
      data-pokemon-id={row.id}
      role="treeitem"
      aria-selected={selected}
      aria-expanded={canExpand ? expanded : undefined}
      aria-level={1}
      // `content-visibility: auto` lets the browser skip offscreen rows —
      // this is the cheap replacement for a virtualization library for
      // the ~1300-row picker (guideline: virtualize large lists).
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: "56px",
      }}
    >
      <div
        className={cn(
          "group relative flex w-full items-center gap-1 pr-3",
          "hover:bg-muted/60",
          selected && "bg-muted",
        )}
      >
        {canExpand ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            tabIndex={-1}
            aria-label={
              expanded
                ? `Collapse ${row.name} forms`
                : `Expand ${row.name} forms (${altCount})`
            }
            className="ml-1 flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronRight
              className={cn(
                "size-3.5 transition-transform",
                expanded && "rotate-90",
              )}
              aria-hidden="true"
            />
          </button>
        ) : (
          // Reserve the same width so species with and without alt forms
          // align the same on a row-by-row basis.
          <span
            aria-hidden="true"
            className="ml-1 inline-block size-6 shrink-0"
          />
        )}

        <button
          type="button"
          onClick={onSelect}
          onKeyDown={(e) => {
            onKeyDown(e as unknown as React.KeyboardEvent<HTMLUListElement>);
          }}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2.5 py-2 pr-1 text-left",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          )}
          aria-label={`${row.name}, number ${row.id}. ${status.label}.${
            altCount > 0
              ? ` ${altCount} alt form${altCount === 1 ? "" : "s"} available.`
              : ""
          }`}
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
              {altCount > 0 ? (
                <span
                  className="ml-auto inline-flex items-center rounded-sm bg-muted px-1 text-[10px] font-medium tabular-nums text-muted-foreground"
                  aria-label={`${altCount} alt form${altCount === 1 ? "" : "s"}`}
                  title={`${altCount} alt form${altCount === 1 ? "" : "s"}`}
                >
                  +{altCount}
                </span>
              ) : null}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <MiniPalette colors={colors} />
              <StatusDot tone={status.tone} label={status.label} />
            </div>
          </div>
        </button>
      </div>
    </li>
  );
}

interface VarietyRowProps {
  row: PokemonColorRow;
  variant: Variant;
  selected: boolean;
  onSelect: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLUListElement>) => void;
}

function VarietyRow({
  row,
  variant,
  selected,
  onSelect,
  onKeyDown,
}: VarietyRowProps) {
  const sprite = variant === "shiny" ? row.shinySpriteUrl : row.spriteUrl;
  const colors = variant === "shiny" ? row.staticShinyColors : row.staticColors;
  const status = statusForRow(row, variant);
  const kind = row.varietyKind ?? "form";

  return (
    <li
      id={`pokemon-row-${row.id}`}
      data-pokemon-id={row.id}
      role="treeitem"
      aria-selected={selected}
      aria-level={2}
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: "52px",
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        onKeyDown={(e) => {
          onKeyDown(e as unknown as React.KeyboardEvent<HTMLUListElement>);
        }}
        className={cn(
          "group flex w-full items-center gap-2.5 py-1.5 pl-9 pr-3 text-left",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          "hover:bg-muted/60",
          selected && "bg-muted",
        )}
        aria-label={`${row.name}, ${VARIETY_KIND_LABEL[kind]} form, number ${row.id}. ${status.label}.`}
        style={{ touchAction: "manipulation" }}
      >
        <div className="relative flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/40">
          {sprite ? (
            <Image
              src={sprite}
              alt=""
              width={32}
              height={32}
              className="size-8 object-contain"
              style={{ imageRendering: "pixelated" }}
              unoptimized
              loading="lazy"
            />
          ) : (
            <span className="text-[9px] text-muted-foreground">N/A</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className="min-w-0 truncate text-[13px] font-medium capitalize"
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
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex h-3.5 items-center rounded-sm px-1 text-[9px] font-semibold uppercase tracking-wide",
                VARIETY_KIND_BADGE[kind],
              )}
            >
              {VARIETY_KIND_LABEL[kind]}
            </span>
            <MiniPalette colors={colors} compact />
            <StatusDot tone={status.tone} label={status.label} />
          </div>
        </div>
      </button>
    </li>
  );
}

function MiniPalette({
  colors,
  compact = false,
}: {
  colors: string[];
  compact?: boolean;
}) {
  const padded = [...colors];
  while (padded.length < 6) padded.push("");
  const swatchWidth = compact ? 8 : 10;
  const totalWidth = swatchWidth * 6;
  return (
    <div
      aria-hidden="true"
      className="flex h-3 overflow-hidden rounded-sm border"
      style={{ width: `${totalWidth}px` }}
    >
      {padded.slice(0, 6).map((hex, i) => (
        <span
          key={i}
          className="h-full"
          style={{
            width: `${swatchWidth}px`,
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
