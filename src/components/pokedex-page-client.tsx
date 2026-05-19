"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import Image from "next/image";
import Link from "next/link";
import { useUser, SignInButton } from "@clerk/nextjs";
import {
  BookMarked,
  Loader2,
  LogIn,
  Sparkles,
  Gamepad2,
  HelpCircle,
  ArrowLeft,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { Footer } from "@/components/footer";

import { getAllPokemonMetadata, getPokemonById } from "@/lib/pokemon";
import { usePokedex, type PokedexEntry } from "@/hooks/use-pokedex";
import type { Pokemon, PokemonMetadata } from "@/types/pokemon";

// Generation boundaries (national-dex IDs). The metadata index ships every
// Pokémon with `generation: 1` upstream, so we derive the real generation
// from the dex number — same trick the explore page uses.
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

// Roman numerals for generation labels. Hard-coded for 1–9 since the
// franchise has at most one generation we'd ever realistically need to
// append, and the algorithm-driven version is overkill for nine values.
const ROMAN_NUMERALS: Record<number, string> = {
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
  5: "V",
  6: "VI",
  7: "VII",
  8: "VIII",
  9: "IX",
};

type CatchFilter = "both" | "caught" | "uncaught";

const CATCH_FILTER_LABELS: Record<CatchFilter, string> = {
  both: "All entries",
  caught: "Caught only",
  uncaught: "Uncaught only",
};

// Sprite source for every cell — the bundled static PNGs under
// `/public/pokemon/sprites/**`. We use the shiny folder for caught shiny
// entries and the normal folder otherwise (including uncaught silhouettes,
// which apply a brightness:0 filter so colors aren't spoiled).
function spritePath(id: number, isShiny: boolean): string {
  return isShiny
    ? `/pokemon/sprites/shiny/${id}.png`
    : `/pokemon/sprites/${id}.png`;
}

interface CaughtState {
  normal: boolean;
  shiny: boolean;
  // Most recent catch across both variants. Kept around so we could
  // surface "newest catches" sorting in a future iteration without
  // rebuilding the map.
  latestCatch?: PokedexEntry;
}

type GenTab = "all" | number;

export function PokedexPageClient() {
  const { user, isLoaded } = useUser();
  const { entries, loading } = usePokedex();
  const allPokemon = getAllPokemonMetadata();

  // The shiny toggle now switches between two complete dex lists: the
  // normal-catch dex and the shiny-catch dex. Both lists render every
  // Pokémon — what changes is which catches "unlock" each entry.
  const [shinyView, setShinyView] = useState(false);
  // Generation filter via tabs (1–9 or "all").
  const [genTab, setGenTab] = useState<GenTab>("all");
  // Catch-state filter. "both" shows everything (default); the other two
  // narrow to entries unlocked / locked in the current dex view.
  const [catchFilter, setCatchFilter] = useState<CatchFilter>("both");

  // Build a quick lookup from the user's catches: pokemonId -> {normal,shiny}.
  const caughtMap = useMemo<Map<number, CaughtState>>(() => {
    const map = new Map<number, CaughtState>();
    for (const e of entries) {
      const existing = map.get(e.pokemon_id) ?? { normal: false, shiny: false };
      if (e.is_shiny) existing.shiny = true;
      else existing.normal = true;
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

  // Filter by generation tab + catch state. The catch filter respects the
  // current dex view: in shiny mode "caught" means shiny-caught, in normal
  // mode it means normal-caught.
  const filteredPokemon = useMemo<PokemonMetadata[]>(() => {
    return allPokemon.filter((meta) => {
      if (genTab !== "all" && genFromId(meta.id) !== genTab) return false;
      if (catchFilter !== "both") {
        const state = caughtMap.get(meta.id);
        const isCaught = shinyView ? !!state?.shiny : !!state?.normal;
        if (catchFilter === "caught" && !isCaught) return false;
        if (catchFilter === "uncaught" && isCaught) return false;
      }
      return true;
    });
  }, [allPokemon, genTab, catchFilter, caughtMap, shinyView]);

  // Scroll container for the virtualized grid. The page uses a fixed
  // viewport-height frame, so the virtualizer needs an element ref to
  // attach its scroll listener.
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex h-screen overflow-hidden">
      <CollapsibleSidebar primaryColor="#f59e0b" />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
          <div className="container mx-auto px-4 md:px-6 py-4 md:py-6">
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
                {shinyView ? "Shiny Pokedex" : "Pokedex"}
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
                    Pokemon to your Pokedex. Toggle Shiny to view your shiny
                    dex — entries unlock independently for each variant.
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
        <div ref={scrollRef} className="flex-1 overflow-auto">
          <div className="container mx-auto px-4 md:px-6 py-6 md:py-8">
            {!isLoaded ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !user ? (
              <SignedOutEmpty />
            ) : (
              <>
                {/* Generation tabs on their own row so all ten labels stay
                    on a single line, then the catch-state filter and shiny
                    switch on the row below. The two-row split keeps the
                    tab list from collapsing into a ragged wrap when the
                    viewport gets narrow or the trailing controls steal
                    horizontal space. */}
                <div className="mb-4 overflow-x-auto -mx-1 px-1">
                  <Tabs
                    value={String(genTab)}
                    onValueChange={(v) =>
                      setGenTab(v === "all" ? "all" : Number(v))
                    }
                  >
                    <TabsList className="flex w-fit gap-1">
                      <TabsTrigger value="all" className="px-3">
                        All
                      </TabsTrigger>
                      {GENERATION_RANGES.map(({ gen }) => (
                        <TabsTrigger
                          key={gen}
                          value={String(gen)}
                          className="px-3"
                        >
                          Gen {ROMAN_NUMERALS[gen]}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>

                <div className="flex items-center gap-3 mb-6 flex-wrap">
                  <Select
                    value={catchFilter}
                    onValueChange={(v) => setCatchFilter(v as CatchFilter)}
                  >
                    <SelectTrigger
                      className="w-[160px]"
                      aria-label="Filter by catch status"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">
                        {CATCH_FILTER_LABELS.both}
                      </SelectItem>
                      <SelectItem value="caught">
                        {CATCH_FILTER_LABELS.caught}
                      </SelectItem>
                      <SelectItem value="uncaught">
                        {CATCH_FILTER_LABELS.uncaught}
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-2 ml-auto">
                    <Sparkles
                      className={`w-4 h-4 ${
                        shinyView
                          ? "text-yellow-500"
                          : "text-muted-foreground"
                      }`}
                      aria-hidden="true"
                    />
                    <Label
                      htmlFor="shiny-toggle"
                      className="cursor-pointer text-sm font-medium"
                    >
                      Shiny
                    </Label>
                    <Switch
                      id="shiny-toggle"
                      checked={shinyView}
                      onCheckedChange={setShinyView}
                      aria-label="Toggle shiny Pokedex"
                    />
                  </div>
                </div>

                {loading && entries.length === 0 ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">
                      Loading your Pokedex...
                    </span>
                  </div>
                ) : filteredPokemon.length === 0 ? (
                  <EmptyResults />
                ) : (
                  <VirtualizedPokedexGrid
                    items={filteredPokemon}
                    caughtMap={caughtMap}
                    shinyView={shinyView}
                    scrollRef={scrollRef}
                  />
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

// ----------------------------------------------------------------------------
// Virtualized grid
// ----------------------------------------------------------------------------

// Compact cell layout — sprite ~80–96 px, single-line name, slim palette
// strip — lets us pack more entries per row at every breakpoint.
const POKEDEX_GRID_BREAKPOINTS: Array<{ minWidth: number; cols: number }> = [
  { minWidth: 1536, cols: 8 }, // 2xl
  { minWidth: 1280, cols: 7 }, // xl
  { minWidth: 1024, cols: 6 }, // lg
  { minWidth: 768, cols: 5 }, // md
  { minWidth: 640, cols: 4 }, // sm
  { minWidth: 480, cols: 3 }, // xs
  { minWidth: 0, cols: 2 }, // base
];

function columnsForWidth(width: number): number {
  for (const bp of POKEDEX_GRID_BREAKPOINTS) {
    if (width >= bp.minWidth) return bp.cols;
  }
  return 2;
}

function VirtualizedPokedexGrid({
  items,
  caughtMap,
  shinyView,
  scrollRef,
}: {
  items: PokemonMetadata[];
  caughtMap: Map<number, CaughtState>;
  shinyView: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(7);

  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    setColumns(columnsForWidth(el.clientWidth));
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setColumns(columnsForWidth(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rows = useMemo(() => {
    const out: PokemonMetadata[][] = [];
    for (let i = 0; i < items.length; i += columns) {
      out.push(items.slice(i, i + columns));
    }
    return out;
  }, [items, columns]);

  // Row estimate: ~96px sprite area + ~38px name block + 16px palette + gap.
  // The virtualizer re-measures after first paint, so a coarse estimate is fine.
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 200,
    overscan: 4,
  });

  useEffect(() => {
    rowVirtualizer.measure();
  }, [columns, rowVirtualizer]);

  const totalHeight = rowVirtualizer.getTotalSize();
  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div
      ref={gridRef}
      style={{ height: totalHeight, position: "relative", width: "100%" }}
    >
      {virtualRows.map((virtualRow) => {
        const row = rows[virtualRow.index];
        if (!row) return null;
        return (
          <div
            key={virtualRow.key}
            ref={rowVirtualizer.measureElement}
            data-index={virtualRow.index}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start}px)`,
            }}
            className="pb-3"
          >
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              }}
            >
              {row.map((meta) => (
                <PokedexCell
                  key={meta.id}
                  meta={meta}
                  state={caughtMap.get(meta.id) ?? null}
                  shinyView={shinyView}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Cell
// ----------------------------------------------------------------------------

function PokedexCell({
  meta,
  state,
  shinyView,
}: {
  meta: PokemonMetadata;
  state: CaughtState | null;
  shinyView: boolean;
}) {
  // The "unlocked" state depends on which dex is being viewed: shiny view
  // only counts shiny catches, normal view only counts normal catches.
  const isCaught = shinyView ? !!state?.shiny : !!state?.normal;
  // Caught entries get the shiny sprite when in shiny view; uncaught entries
  // always pull the normal sprite (rendered as a silhouette via CSS) so the
  // species' colors aren't leaked through the shiny variant.
  const spriteUrl = spritePath(meta.id, isCaught && shinyView);

  // The detail route is only meaningful for caught entries — uncaught
  // cells aren't interactive so we don't spoil the species.
  const href = isCaught
    ? shinyView
      ? `/shiny/${meta.name.toLowerCase()}`
      : `/${meta.name.toLowerCase()}`
    : null;

  const paddedId = meta.id.toString().padStart(3, "0");

  const cellInner = (
    <>
      {/* Sprite area */}
      <div className="relative aspect-square flex items-center justify-center bg-muted/30">
        {isCaught && shinyView && (
          <div className="absolute top-1.5 right-1.5 z-10">
            <Sparkles
              className="w-3.5 h-3.5 text-yellow-500"
              aria-label="Shiny caught"
            />
          </div>
        )}
        <Image
          src={spriteUrl}
          alt={
            isCaught
              ? meta.name
              : `Uncaught silhouette (#${paddedId})`
          }
          width={128}
          height={128}
          className={`w-20 h-20 sm:w-24 sm:h-24 object-contain ${
            isCaught ? "" : "[filter:brightness(0)_opacity(0.55)]"
          }`}
          style={{ imageRendering: "pixelated" }}
          unoptimized
          loading="lazy"
        />
      </div>

      {/* Name + number */}
      <div className="px-2 pt-2 pb-1.5 text-center">
        <div className="font-heading text-[11px] font-semibold tabular-nums text-muted-foreground leading-tight">
          #{paddedId}
        </div>
        <div
          className={`font-heading text-base font-bold truncate leading-tight ${
            isCaught ? "" : "text-muted-foreground"
          }`}
        >
          {isCaught ? meta.name : "???"}
        </div>
      </div>

      {/* Six-color palette swatch row. Real palette for caught entries
          (loaded on demand), muted placeholders for uncaught so the
          uncaught silhouette doesn't reveal the species colors. */}
      <PaletteRow
        pokemonId={meta.id}
        unlocked={isCaught}
        shiny={shinyView}
      />
    </>
  );

  const cellClass = `group relative rounded-xl border bg-card overflow-hidden transition-colors ${
    isCaught
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

  return (
    <div
      className={cellClass}
      title="Catch this Pokemon by guessing it in the game"
    >
      {cellInner}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Palette row — lazily loads each cell's full Pokemon record so we can
// render the six-color highlight strip from the saved palette. The cache
// in `getPokemonById` dedupes by id across the whole session, so virtual
// rows re-mounting while scrolling never re-fetch.
// ----------------------------------------------------------------------------

// Up to six greyscale placeholder squares for locked entries. The slot count
// is fixed for locked cells so the row height stays consistent; for unlocked
// cells we render only the actual palette colors with no padding.
const PLACEHOLDER_COLORS = Array.from({ length: 6 }, () => "#e5e5e5");

function PaletteRow({
  pokemonId,
  unlocked,
  shiny,
}: {
  pokemonId: number;
  unlocked: boolean;
  shiny: boolean;
}) {
  const [pokemon, setPokemon] = useState<Pokemon | null>(null);

  useEffect(() => {
    // Don't fetch palettes for uncaught entries — showing real colors
    // there would spoil the guessing game. The placeholder swatch keeps
    // the cell layout consistent until the user actually catches it.
    if (!unlocked) {
      setPokemon(null);
      return;
    }
    let cancelled = false;
    getPokemonById(pokemonId).then((p) => {
      if (!cancelled && p) setPokemon(p);
    });
    return () => {
      cancelled = true;
    };
  }, [pokemonId, unlocked]);

  // Pick the right palette: shiny view uses `shinyColorPalette` when
  // present, otherwise we fall back to the normal palette so the row
  // still renders something useful instead of an empty strip.
  // We render only the colors that actually exist (capped at 6) — no
  // padding-by-repeating-the-last-color, which made e.g. Bulbasaur's
  // 3-color shiny palette look like a 6-color one.
  const colors = useMemo<string[]>(() => {
    if (!unlocked) return PLACEHOLDER_COLORS;
    if (!pokemon) return [];
    const source =
      (shiny && pokemon.shinyColorPalette) || pokemon.colorPalette;
    const highlights = source?.highlights ?? [];
    return highlights.slice(0, 6);
  }, [pokemon, shiny, unlocked]);

  // Hide the strip entirely if a caught entry's palette hasn't loaded
  // yet — better than flashing an empty bar with the wrong height.
  if (colors.length === 0) {
    return <div className="h-4 w-full border-t bg-muted/30" />;
  }

  return (
    <div className="flex h-4 w-full border-t" aria-hidden={!unlocked}>
      {colors.map((color, i) => (
        <div
          key={i}
          className={`flex-1 ${unlocked ? "" : "opacity-40"}`}
          style={{ backgroundColor: color }}
          title={unlocked ? color : undefined}
        />
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Empty / signed-out states
// ----------------------------------------------------------------------------

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

function EmptyResults() {
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
