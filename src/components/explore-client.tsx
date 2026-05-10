"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Compass,
  Filter,
  Search,
  Shuffle,
  SortAsc,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { PokemonPaletteExploreCard } from "@/components/pokemon-palette-explore-card";
import { AdUnit, ADSENSE_SLOTS } from "@/components/analytics/google-adsense";
import type { PokemonMetadata, PokemonType } from "@/types/pokemon";

const ALL_TYPES: PokemonType[] = [
  "Normal",
  "Fire",
  "Water",
  "Electric",
  "Grass",
  "Ice",
  "Fighting",
  "Poison",
  "Ground",
  "Flying",
  "Psychic",
  "Bug",
  "Rock",
  "Ghost",
  "Dragon",
  "Dark",
  "Steel",
  "Fairy",
];

// Generation boundaries (national-dex IDs). The metadata file ships every
// Pokémon with `generation: 1` upstream, so we derive the real generation
// from the dex number — see the bug-bracket logic in pokemon-search.tsx.
const GENERATION_RANGES: Array<{ gen: number; max: number }> = [
  { gen: 1, max: 151 },
  { gen: 2, max: 251 },
  { gen: 3, max: 386 },
  { gen: 4, max: 493 },
  { gen: 5, max: 649 },
  { gen: 6, max: 721 },
  { gen: 7, max: 809 },
  { gen: 8, max: 905 },
  { gen: 9, max: 1025 },
];

function genFromId(id: number): number {
  for (const { gen, max } of GENERATION_RANGES) {
    if (id <= max) return gen;
  }
  return 9;
}

type SortKey = "id-asc" | "id-desc" | "name-asc" | "name-desc";

const SORT_LABELS: Record<SortKey, string> = {
  "id-asc": "Dex No. (low → high)",
  "id-desc": "Dex No. (high → low)",
  "name-asc": "Name (A → Z)",
  "name-desc": "Name (Z → A)",
};

const PAGE_SIZE = 60;

interface ExploreClientProps {
  /** Full Pokémon metadata index — passed in from the server component so
   * we don't ship two copies (one bundled, one streamed). */
  allMetadata: PokemonMetadata[];
  /** All rarities present in the dataset, in the order they should appear
   * in the filter and quick-browse rows. */
  rarities: string[];
  /** Pre-loaded full Pokémon data for the first batch by dex number. Cards
   * that match these IDs render their palette immediately; the rest lazy-
   * load via IntersectionObserver inside `PokemonPaletteExploreCard`. */
  initialPokemonData: Array<[number, unknown]>;
}

function parseList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isSortKey(value: string | null): value is SortKey {
  return (
    value === "id-asc" ||
    value === "id-desc" ||
    value === "name-asc" ||
    value === "name-desc"
  );
}

export function ExploreClient({
  allMetadata,
  rarities,
  initialPokemonData,
}: ExploreClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Pre-loaded Pokémon data is keyed by id. Cards look themselves up here
  // before falling back to client-side fetch.
  const initialDataMap = useMemo(() => {
    return new Map<number, unknown>(initialPokemonData);
  }, [initialPokemonData]);

  // ---- URL-derived state ---------------------------------------------------
  // The filter bar reads all of its state from the URL query string so the
  // page is fully linkable (and back/forward navigation just works).
  const search = searchParams.get("q") ?? "";
  const selectedTypes = useMemo(
    () => new Set(parseList(searchParams.get("type"))),
    [searchParams]
  );
  const selectedGens = useMemo(() => {
    const raw = parseList(searchParams.get("gen"));
    return new Set(raw.map((g) => Number(g)).filter((g) => !Number.isNaN(g)));
  }, [searchParams]);
  const selectedRarities = useMemo(
    () => new Set(parseList(searchParams.get("rarity"))),
    [searchParams]
  );
  const sortRaw = searchParams.get("sort");
  const sort: SortKey = isSortKey(sortRaw) ? sortRaw : "id-asc";

  // ---- Local-only UI state -------------------------------------------------
  // The search input is a controlled debounced mirror of `?q=` so each
  // keystroke doesn't push to the URL. We commit on a 200 ms idle.
  const [searchInput, setSearchInput] = useState(search);
  // Pagination resets to one page on every filter change. Tracked locally so
  // it doesn't pollute the URL.
  const [page, setPage] = useState(1);

  // Keep the input in sync with URL params (e.g. when the user clears all
  // filters or hits back/forward).
  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  // Debounce search → URL.
  useEffect(() => {
    if (searchInput === search) return;
    const t = window.setTimeout(() => {
      updateParams({ q: searchInput || null });
    }, 200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Reset pagination whenever any filter or sort changes.
  useEffect(() => {
    setPage(1);
  }, [search, selectedTypes, selectedGens, selectedRarities, sort]);

  const updateParams = useCallback(
    (changes: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams]
  );

  const toggleSetParam = useCallback(
    (key: string, value: string) => {
      const current = new Set(parseList(searchParams.get(key)));
      if (current.has(value)) current.delete(value);
      else current.add(value);
      const next = Array.from(current);
      updateParams({ [key]: next.length ? next.join(",") : null });
    },
    [searchParams, updateParams]
  );

  // ---- Filtering & sorting -------------------------------------------------
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = allMetadata.filter((meta) => {
      if (q) {
        const idStr = meta.id.toString();
        const padded = idStr.padStart(3, "0");
        const matchesQuery =
          meta.name.toLowerCase().includes(q) ||
          (meta.species && meta.species.toLowerCase().includes(q)) ||
          idStr.includes(q) ||
          padded.includes(q);
        if (!matchesQuery) return false;
      }
      if (selectedTypes.size > 0) {
        const hit = meta.type.some((t) => selectedTypes.has(t));
        if (!hit) return false;
      }
      if (selectedGens.size > 0) {
        if (!selectedGens.has(genFromId(meta.id))) return false;
      }
      if (selectedRarities.size > 0) {
        if (!selectedRarities.has(meta.rarity)) return false;
      }
      return true;
    });

    switch (sort) {
      case "id-desc":
        result.sort((a, b) => b.id - a.id);
        break;
      case "name-asc":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name-desc":
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "id-asc":
      default:
        result.sort((a, b) => a.id - b.id);
        break;
    }
    return result;
  }, [allMetadata, search, selectedTypes, selectedGens, selectedRarities, sort]);

  const visible = useMemo(
    () => filtered.slice(0, page * PAGE_SIZE),
    [filtered, page]
  );

  // Counts for active filter badges.
  const activeFilterCount =
    (search ? 1 : 0) +
    selectedTypes.size +
    selectedGens.size +
    selectedRarities.size;
  const hasActiveFilters = activeFilterCount > 0;

  const handleClearAll = () => {
    setSearchInput("");
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  };

  const handleRandom = () => {
    if (filtered.length === 0) return;
    const pick = filtered[Math.floor(Math.random() * filtered.length)];
    if (!pick) return;
    // Open the detail page for this Pokémon — uses soft navigation so the
    // sidebar's transition stays mounted.
    router.push(`/${pick.name.toLowerCase()}`);
  };

  // Available generations & rarities present in the index — only show
  // filter options that actually match something.
  const availableGens = useMemo(() => {
    const set = new Set<number>();
    for (const m of allMetadata) set.add(genFromId(m.id));
    return Array.from(set).sort((a, b) => a - b);
  }, [allMetadata]);

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: "Explore", href: "/explore" },
  ];

  return (
    <div className="container mx-auto px-4 md:px-6 py-6 md:py-10">
      <Breadcrumbs items={breadcrumbs} className="mb-6" />

      {/* ---------- Hero ---------- */}
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Compass className="h-6 w-6 text-primary" aria-hidden="true" />
            <h1 className="font-heading text-3xl font-bold md:text-4xl text-balance">
              Explore Pokémon Palettes
            </h1>
          </div>
          <p className="max-w-2xl text-muted-foreground text-pretty">
            Browse color palettes pulled from{" "}
            <span
              className="font-semibold text-foreground"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {allMetadata.length.toLocaleString()}
            </span>{" "}
            Pokémon. Filter by type, generation, or rarity, then click any card
            to open it in the palette editor.
          </p>
        </div>

        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleRandom}
            disabled={filtered.length === 0}
            className="gap-2"
          >
            <Shuffle className="h-4 w-4" aria-hidden="true" />
            Random Pick
          </Button>
        </div>
      </header>

      {/* ---------- Quick browse rows ---------- */}
      <section
        aria-labelledby="quick-browse-heading"
        className="mb-6 rounded-xl border bg-muted/30 p-4 md:p-5"
      >
        <h2
          id="quick-browse-heading"
          className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Quick Browse
        </h2>
        <div className="space-y-3">
          <QuickBrowseRow label="Type">
            {ALL_TYPES.map((t) => (
              <Link
                key={t}
                href={`/type/${t.toLowerCase()}`}
                className="rounded-md bg-background px-2.5 py-1 text-xs font-medium border hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {t}
              </Link>
            ))}
          </QuickBrowseRow>
          <QuickBrowseRow label="Rarity">
            {rarities.map((r) => (
              <Link
                key={r}
                href={`/rarity/${r.toLowerCase()}`}
                className="rounded-md bg-background px-2.5 py-1 text-xs font-medium border hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {r}
              </Link>
            ))}
          </QuickBrowseRow>
          <QuickBrowseRow label="Generation">
            {availableGens.map((g) => (
              <Link
                key={g}
                href={`/generation/${g}`}
                className="rounded-md bg-background px-2.5 py-1 text-xs font-medium border hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                Gen {g}
              </Link>
            ))}
          </QuickBrowseRow>
        </div>
      </section>

      {/* ---------- Filter bar ---------- */}
      <div className="sticky top-0 z-20 -mx-4 mb-4 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="explore-search" className="sr-only">
            Search Pokémon by name or dex number
          </label>
          <div className="relative min-w-[220px] flex-1 md:max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="explore-search"
              type="search"
              autoComplete="off"
              spellCheck={false}
              placeholder="Search by name or number…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2" type="button">
                <Filter className="h-4 w-4" aria-hidden="true" />
                Type
                {selectedTypes.size > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {selectedTypes.size}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-80 w-44 overflow-y-auto"
            >
              <DropdownMenuLabel>Type</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ALL_TYPES.map((t) => (
                <DropdownMenuCheckboxItem
                  key={t}
                  checked={selectedTypes.has(t)}
                  onCheckedChange={() => toggleSetParam("type", t)}
                >
                  {t}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2" type="button">
                <Filter className="h-4 w-4" aria-hidden="true" />
                Generation
                {selectedGens.size > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {selectedGens.size}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuLabel>Generation</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableGens.map((g) => (
                <DropdownMenuCheckboxItem
                  key={g}
                  checked={selectedGens.has(g)}
                  onCheckedChange={() => toggleSetParam("gen", String(g))}
                >
                  Generation {g}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {rarities.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2" type="button">
                  <Filter className="h-4 w-4" aria-hidden="true" />
                  Rarity
                  {selectedRarities.size > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-1 h-5 px-1.5 text-xs"
                    >
                      {selectedRarities.size}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuLabel>Rarity</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {rarities.map((r) => (
                  <DropdownMenuCheckboxItem
                    key={r}
                    checked={selectedRarities.has(r)}
                    onCheckedChange={() => toggleSetParam("rarity", r)}
                  >
                    {r}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2" type="button">
                <SortAsc className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Sort:</span>
                <span className="max-w-[12ch] truncate">
                  {SORT_LABELS[sort]}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={sort}
                onValueChange={(v) =>
                  updateParams({ sort: v === "id-asc" ? null : v })
                }
              >
                {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                  <DropdownMenuRadioItem key={key} value={key}>
                    {SORT_LABELS[key]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              type="button"
              onClick={handleClearAll}
              className="text-muted-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Clear
            </Button>
          )}

          <p
            className="ml-auto text-sm text-muted-foreground"
            style={{ fontVariantNumeric: "tabular-nums" }}
            aria-live="polite"
          >
            {filtered.length === allMetadata.length
              ? `${filtered.length.toLocaleString()} Pokémon`
              : `${filtered.length.toLocaleString()} of ${allMetadata.length.toLocaleString()} Pokémon`}
          </p>
        </div>

        {/* Active filter chips — clickable to remove individually. */}
        {hasActiveFilters && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {search && (
              <ActiveChip
                label={`"${search}"`}
                onClear={() => {
                  setSearchInput("");
                  updateParams({ q: null });
                }}
              />
            )}
            {Array.from(selectedTypes).map((t) => (
              <ActiveChip
                key={`type-${t}`}
                label={t}
                onClear={() => toggleSetParam("type", t)}
              />
            ))}
            {Array.from(selectedGens).map((g) => (
              <ActiveChip
                key={`gen-${g}`}
                label={`Gen ${g}`}
                onClear={() => toggleSetParam("gen", String(g))}
              />
            ))}
            {Array.from(selectedRarities).map((r) => (
              <ActiveChip
                key={`rarity-${r}`}
                label={r}
                onClear={() => toggleSetParam("rarity", r)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ---------- Results grid / empty state ---------- */}
      {filtered.length === 0 ? (
        <EmptyState onClear={handleClearAll} />
      ) : (
        <>
          <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 md:grid-cols-3 md:gap-6 lg:grid-cols-4 xl:grid-cols-5">
            {visible.map((meta, i) => (
              <Fragment key={meta.id}>
                <li>
                  <PokemonPaletteExploreCard
                    metadata={meta}
                    pokemonData={initialDataMap.get(meta.id)}
                  />
                </li>
                {(i === 11 || (i === 35 && visible.length > 35)) && (
                  <li className="col-span-full">
                    <AdUnit
                      slot={ADSENSE_SLOTS.exploreInFeed}
                      style={{ display: "block", minHeight: 120 }}
                    />
                  </li>
                )}
              </Fragment>
            ))}
          </ul>

          {visible.length < filtered.length && (
            <div className="mt-8 flex flex-col items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setPage((p) => p + 1)}
              >
                Show More
              </Button>
              <p
                className="text-xs text-muted-foreground"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                Showing {visible.length.toLocaleString()} of{" "}
                {filtered.length.toLocaleString()}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function QuickBrowseRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-20 flex-shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function ActiveChip({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-0.5 text-xs">
      <span className="font-medium">{label}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remove ${label} filter`}
        className="-mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </span>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold">No matches found</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground text-pretty">
        Try removing a filter or searching for a different name.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClear}
        className="mt-4"
      >
        Clear all filters
      </Button>
    </div>
  );
}
