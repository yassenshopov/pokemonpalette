"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useUser, SignInButton } from "@clerk/nextjs";
import {
  BookMarked,
  Filter,
  Loader2,
  LogIn,
  Search,
  Sparkles,
  Gamepad2,
  HelpCircle,
  ArrowLeft,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { Footer } from "@/components/footer";

import { getAllPokemonMetadata } from "@/lib/pokemon";
import { usePokedex, type PokedexEntry } from "@/hooks/use-pokedex";
import type { PokemonMetadata, PokemonType } from "@/types/pokemon";

// Sprite sources mirror the rest of the app — `public/pokemon/sprites/...`
// is bundled at build time so the grid renders without external requests.
function spriteUrl(id: number, isShiny: boolean): string {
  return isShiny
    ? `/pokemon/sprites/shiny/${id}.png`
    : `/pokemon/sprites/${id}.png`;
}

// All 18 types — used to populate the type filter dropdown.
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

type CaughtFilter =
  | "all"
  | "caught_any"
  | "caught_normal"
  | "caught_shiny"
  | "uncaught"
  | "missing_shiny";

interface CaughtState {
  normal: boolean;
  shiny: boolean;
  // Most recent catch across both variants, used for sort-by-recent.
  latestCatch?: PokedexEntry;
}

export function PokedexPageClient() {
  const { user, isLoaded } = useUser();
  const { entries, loading } = usePokedex();
  const allPokemon = getAllPokemonMetadata();

  // UI filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenerations, setSelectedGenerations] = useState<Set<number>>(
    new Set()
  );
  const [selectedTypes, setSelectedTypes] = useState<Set<PokemonType>>(
    new Set()
  );
  const [caughtFilter, setCaughtFilter] = useState<CaughtFilter>("all");
  // Show the shiny variant of caught Pokemon when toggled on. Doesn't
  // affect uncaught silhouettes (no variant to choose from).
  const [shinyView, setShinyView] = useState(false);

  // Build a quick lookup from the user's catches: pokemonId -> {normal,shiny}
  const caughtMap = useMemo<Map<number, CaughtState>>(() => {
    const map = new Map<number, CaughtState>();
    for (const e of entries) {
      const existing = map.get(e.pokemon_id) ?? { normal: false, shiny: false };
      if (e.is_shiny) existing.shiny = true;
      else existing.normal = true;
      // Track the latest of either variant for sort-by-recent.
      if (
        !existing.latestCatch ||
        new Date(e.caught_at).getTime() >
          new Date(existing.latestCatch.caught_at).getTime()
      ) {
        existing.latestCatch = e;
      }
      map.set(e.pokemon_id, existing);
    }
    return map;
  }, [entries]);

  // Aggregate stats — total caught, normal/shiny breakdowns, completion.
  const stats = useMemo(() => {
    const total = allPokemon.length;
    let normalCaught = 0;
    let shinyCaught = 0;
    let anyCaught = 0;
    for (const meta of allPokemon) {
      const state = caughtMap.get(meta.id);
      if (!state) continue;
      if (state.normal) normalCaught++;
      if (state.shiny) shinyCaught++;
      if (state.normal || state.shiny) anyCaught++;
    }
    return {
      total,
      anyCaught,
      normalCaught,
      shinyCaught,
      completionPct: total > 0 ? Math.round((anyCaught / total) * 100) : 0,
    };
  }, [allPokemon, caughtMap]);

  const availableGenerations = useMemo(() => {
    const gens = new Set<number>();
    for (const p of allPokemon) gens.add(p.generation);
    return Array.from(gens).sort((a, b) => a - b);
  }, [allPokemon]);

  // Apply filters.
  const filteredPokemon = useMemo<PokemonMetadata[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    return allPokemon.filter((meta) => {
      // Search by name or ID number.
      if (q) {
        const idStr = meta.id.toString();
        const paddedId = meta.id.toString().padStart(3, "0");
        if (
          !meta.name.toLowerCase().includes(q) &&
          !idStr.includes(q) &&
          !paddedId.includes(q) &&
          !meta.species.toLowerCase().includes(q)
        ) {
          return false;
        }
      }

      if (
        selectedGenerations.size > 0 &&
        !selectedGenerations.has(meta.generation)
      ) {
        return false;
      }

      if (selectedTypes.size > 0) {
        const hit = meta.type.some((t) => selectedTypes.has(t as PokemonType));
        if (!hit) return false;
      }

      const state = caughtMap.get(meta.id);
      switch (caughtFilter) {
        case "caught_any":
          if (!state || (!state.normal && !state.shiny)) return false;
          break;
        case "caught_normal":
          if (!state?.normal) return false;
          break;
        case "caught_shiny":
          if (!state?.shiny) return false;
          break;
        case "uncaught":
          if (state && (state.normal || state.shiny)) return false;
          break;
        case "missing_shiny":
          if (!state?.normal || state?.shiny) return false;
          break;
      }

      return true;
    });
  }, [
    allPokemon,
    searchQuery,
    selectedGenerations,
    selectedTypes,
    caughtFilter,
    caughtMap,
  ]);

  const toggleGeneration = (gen: number) => {
    setSelectedGenerations((prev) => {
      const next = new Set(prev);
      if (next.has(gen)) next.delete(gen);
      else next.add(gen);
      return next;
    });
  };

  const toggleType = (type: PokemonType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedGenerations(new Set());
    setSelectedTypes(new Set());
    setCaughtFilter("all");
  };

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    selectedGenerations.size > 0 ||
    selectedTypes.size > 0 ||
    caughtFilter !== "all";

  return (
    <div className="flex h-screen overflow-hidden">
      <CollapsibleSidebar primaryColor="#f59e0b" />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
          <div className="container mx-auto px-4 md:px-6 py-4 md:py-6">
            {/* Back link — the Pokedex is a sub-route of /game, so a
                quick path back to the active session is the most useful
                affordance up here. */}
            <Link
              href="/game"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to game
            </Link>
            <div className="flex items-center gap-2">
              <BookMarked className="w-6 h-6 text-primary" />
              <h1 className="text-2xl md:text-3xl font-bold font-heading">
                Pokedex
              </h1>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      aria-label="How the Pokedex works"
                      className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    Every correct guess in Daily or Unlimited mode adds the
                    Pokemon to your Pokedex. Catch them in normal and shiny
                    forms to fill out both halves of each entry.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {user
                ? `${stats.anyCaught} / ${stats.total} caught (${stats.completionPct}%) — ${stats.normalCaught} normal, ${stats.shinyCaught} shiny.`
                : "Catch Pokemon by guessing them correctly in Daily or Unlimited mode."}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="container mx-auto px-4 md:px-6 py-6 md:py-8">
            {!isLoaded ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !user ? (
              <SignedOutEmpty />
            ) : (
              <>
                {/* Stats banner. Three small cards summarizing progress —
                    keeps the headline number visible even after the user
                    scrolls past the page header. */}
                <StatsBanner stats={stats} />

                {/* Search + filters */}
                <div className="flex items-center gap-2 mb-6 flex-wrap">
                  <div className="relative flex-1 min-w-[200px] max-w-xl">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4"
                      aria-hidden="true"
                    />
                    <Input
                      placeholder="Search by name, number, or species..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      aria-label="Search Pokedex"
                      type="search"
                    />
                  </div>

                  {/* Generation filter */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <Filter className="w-4 h-4" />
                        Gen
                        {selectedGenerations.size > 0 && (
                          <Badge
                            variant="secondary"
                            className="ml-1 h-5 px-1.5 text-xs"
                          >
                            {selectedGenerations.size}
                          </Badge>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuLabel>Generation</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {availableGenerations.map((gen) => (
                        <DropdownMenuCheckboxItem
                          key={gen}
                          checked={selectedGenerations.has(gen)}
                          onCheckedChange={() => toggleGeneration(gen)}
                        >
                          Generation {gen}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Type filter */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <Filter className="w-4 h-4" />
                        Type
                        {selectedTypes.size > 0 && (
                          <Badge
                            variant="secondary"
                            className="ml-1 h-5 px-1.5 text-xs"
                          >
                            {selectedTypes.size}
                          </Badge>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-44 max-h-72 overflow-y-auto"
                    >
                      <DropdownMenuLabel>Type</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {ALL_TYPES.map((type) => (
                        <DropdownMenuCheckboxItem
                          key={type}
                          checked={selectedTypes.has(type)}
                          onCheckedChange={() => toggleType(type)}
                        >
                          {type}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Caught status filter */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <Filter className="w-4 h-4" />
                        {CAUGHT_FILTER_LABELS[caughtFilter]}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuLabel>Catch status</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup
                        value={caughtFilter}
                        onValueChange={(v) =>
                          setCaughtFilter(v as CaughtFilter)
                        }
                      >
                        <DropdownMenuRadioItem value="all">
                          All Pokemon
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="caught_any">
                          Caught (any variant)
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="caught_normal">
                          Caught — normal
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="caught_shiny">
                          Caught — shiny
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="missing_shiny">
                          Missing shiny
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="uncaught">
                          Not yet caught
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Shiny toggle — flips the displayed sprite for caught
                      entries that have a shiny variant recorded. */}
                  <Button
                    variant={shinyView ? "default" : "outline"}
                    onClick={() => setShinyView((v) => !v)}
                    aria-pressed={shinyView}
                    className="flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Shiny view
                  </Button>

                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      onClick={clearFilters}
                      className="text-muted-foreground"
                    >
                      Clear
                    </Button>
                  )}
                </div>

                {loading && entries.length === 0 ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">
                      Loading your Pokedex...
                    </span>
                  </div>
                ) : filteredPokemon.length === 0 ? (
                  <EmptyResults hasActiveFilters={hasActiveFilters} />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                    {filteredPokemon.map((meta) => (
                      <PokedexCell
                        key={meta.id}
                        meta={meta}
                        state={caughtMap.get(meta.id) ?? null}
                        shinyView={shinyView}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <Footer />
        </div>
      </div>
    </div>
  );
}

const CAUGHT_FILTER_LABELS: Record<CaughtFilter, string> = {
  all: "All",
  caught_any: "Caught",
  caught_normal: "Normal",
  caught_shiny: "Shiny",
  missing_shiny: "No shiny",
  uncaught: "Uncaught",
};

function StatsBanner({
  stats,
}: {
  stats: {
    total: number;
    anyCaught: number;
    normalCaught: number;
    shinyCaught: number;
    completionPct: number;
  };
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <StatCard label="Caught" value={`${stats.anyCaught}/${stats.total}`} />
      <StatCard
        label="Completion"
        value={`${stats.completionPct}%`}
      />
      <StatCard label="Normal" value={String(stats.normalCaught)} />
      <StatCard
        label="Shiny"
        value={String(stats.shinyCaught)}
        accent
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border bg-card p-3 ${
        accent ? "border-yellow-500/40" : ""
      }`}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`text-xl font-bold font-heading mt-0.5 ${
          accent ? "text-yellow-500" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function PokedexCell({
  meta,
  state,
  shinyView,
}: {
  meta: PokemonMetadata;
  state: CaughtState | null;
  shinyView: boolean;
}) {
  const normalCaught = !!state?.normal;
  const shinyCaught = !!state?.shiny;
  const anyCaught = normalCaught || shinyCaught;

  // Choose which sprite to render. If the user has the shiny and shinyView
  // is on, prefer it. Otherwise fall back to whichever variant they own.
  // Uncaught Pokemon render the normal sprite as a silhouette so size and
  // pose stay consistent.
  const showShiny = shinyView && shinyCaught;
  const url = spriteUrl(meta.id, showShiny);

  const href = anyCaught
    ? showShiny
      ? `/shiny/${meta.name.toLowerCase()}`
      : `/${meta.name.toLowerCase()}`
    : null;

  const cellInner = (
    <>
      <div className="relative aspect-square flex items-center justify-center">
        {/* Shiny indicator — top-right when caught, gray when missing
            (only on caught Pokemon to advertise the next milestone). */}
        {anyCaught && (
          <div className="absolute top-1 right-1 z-10">
            <Sparkles
              className={`w-3.5 h-3.5 ${
                shinyCaught
                  ? "text-yellow-500"
                  : "text-muted-foreground/40"
              }`}
              aria-label={shinyCaught ? "Shiny caught" : "Shiny not caught"}
            />
          </div>
        )}
        {/* The sprite. Uncaught Pokemon get a CSS silhouette via brightness:0
            so we still show their shape (the classic Pokedex effect) without
            spoiling color. The image is loaded eagerly only for caught
            entries so we don't blow the budget on an uncaught player's
            grid. */}
        <Image
          src={url}
          alt={anyCaught ? meta.name : "Unknown Pokemon"}
          width={96}
          height={96}
          className={`w-16 h-16 sm:w-20 sm:h-20 object-contain transition-transform group-hover:scale-110 ${
            anyCaught ? "" : "[filter:brightness(0)_opacity(0.55)]"
          }`}
          style={{ imageRendering: "pixelated" }}
          unoptimized
          loading={anyCaught ? "lazy" : "lazy"}
        />
      </div>
      <div className="px-2 pb-2 text-center">
        <div className="text-[10px] text-muted-foreground tabular-nums">
          #{meta.id.toString().padStart(3, "0")}
        </div>
        <div
          className={`text-xs font-medium truncate ${
            anyCaught ? "" : "text-muted-foreground"
          }`}
        >
          {anyCaught ? meta.name : "???"}
        </div>
      </div>
    </>
  );

  const cellClass = `group relative rounded-lg border bg-card overflow-hidden transition-colors ${
    anyCaught
      ? "hover:bg-accent cursor-pointer"
      : "opacity-80 hover:opacity-100"
  }`;

  if (href) {
    return (
      <Link
        href={href}
        className={cellClass}
        aria-label={`View ${meta.name}'s palette`}
      >
        {cellInner}
      </Link>
    );
  }

  // Uncaught — non-interactive, but show the locked tooltip state.
  return (
    <div
      className={cellClass}
      title="Catch this Pokemon by guessing it in the game"
    >
      {cellInner}
    </div>
  );
}

function SignedOutEmpty() {
  return (
    <div className="max-w-md mx-auto text-center py-16 text-muted-foreground">
      <BookMarked className="w-12 h-12 mx-auto mb-4 opacity-50" />
      <p className="text-lg font-medium mb-2 text-foreground">
        Sign in to start your Pokedex
      </p>
      <p className="text-sm mb-6">
        Track every Pokemon you&apos;ve caught — normal and shiny — across all
        your devices.
      </p>
      <div className="flex items-center justify-center gap-2">
        <SignInButton mode="modal">
          <Button className="cursor-pointer">
            <LogIn className="w-4 h-4 mr-2" />
            Sign in
          </Button>
        </SignInButton>
        <Link href="/game">
          <Button variant="outline" className="cursor-pointer">
            <Gamepad2 className="w-4 h-4 mr-2" />
            Play the game
          </Button>
        </Link>
      </div>
    </div>
  );
}

function EmptyResults({ hasActiveFilters }: { hasActiveFilters: boolean }) {
  if (!hasActiveFilters) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <BookMarked className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium mb-2 text-foreground">
          No Pokemon to show
        </p>
        <p className="text-sm mb-6">
          Catch your first Pokemon by guessing it correctly in the game.
        </p>
        <Link href="/game">
          <Button variant="outline" className="cursor-pointer">
            <Gamepad2 className="w-4 h-4 mr-2" />
            Play the game
          </Button>
        </Link>
      </div>
    );
  }
  return (
    <div className="text-center py-16 text-muted-foreground">
      <Filter className="w-12 h-12 mx-auto mb-4 opacity-50" />
      <p className="text-lg font-medium mb-2 text-foreground">
        No Pokemon match your filters
      </p>
      <p className="text-sm">Try adjusting your search or filter criteria.</p>
    </div>
  );
}
