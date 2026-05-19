"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { writePokemonMenuCookie } from "@/lib/pokemon-menu-cookie";
import { PokemonMenu } from "@/components/pokemon-menu";
import { PokemonHero } from "@/components/pokemon-hero";
import { PokemonPaletteDisplay } from "@/components/pokemon-palette-display";
import { Footer } from "@/components/footer";
import { AdUnit, ADSENSE_SLOTS } from "@/components/analytics/google-adsense";

// Lazy-load components that aren't needed for the initial render (only appear
// after a color is extracted or on specific interactions). Keeps First Load JS
// on `/` lean.
const CollapsibleSidebar = dynamic(
  () =>
    import("@/components/collapsible-sidebar").then((m) => ({
      default: m.CollapsibleSidebar,
    })),
  { ssr: false }
);
const PokemonCard = dynamic(
  () =>
    import("@/components/pokemon-card").then((m) => ({ default: m.PokemonCard })),
  { ssr: false }
);
const ColorShowcase = dynamic(
  () =>
    import("@/components/color-showcase").then((m) => ({
      default: m.ColorShowcase,
    })),
  { ssr: false }
);
const CoffeeCTA = dynamic(
  () => import("@/components/coffee-cta").then((m) => ({ default: m.CoffeeCTA })),
  { ssr: false }
);
const ThemeExporter = dynamic(
  () =>
    import("@/components/theme-exporter").then((m) => ({
      default: m.ThemeExporter,
    })),
  { ssr: false }
);
interface HomeClientProps {
  /** Server-seeded initial value for the Pokémon-menu collapsed
   *  state, parsed from the `pokemon_menu_collapsed` cookie in the
   *  parent server component. Eliminates the hydration flash where
   *  the menu used to render expanded for every visit, then snap to
   *  the user's persisted preference one frame later. */
  initialMenuCollapsed?: boolean;
}

export function HomeClient({ initialMenuCollapsed = false }: HomeClientProps) {
  const [selectedPokemonId, setSelectedPokemonId] = useState<number | null>(
    null
  );
  const [isShiny, setIsShiny] = useState(false);
  const [, setCurrentImageSrc] = useState<string | null>(null);
  const [pokemonColors, setPokemonColors] = useState<string[]>([]);
  const [isPokemonMenuCollapsed, setIsPokemonMenuCollapsed] = useState(
    initialMenuCollapsed,
  );
  const [selectedVarietyId, setSelectedVarietyId] = useState<number | null>(null);
  const [selectedFormName, setSelectedFormName] = useState<string | null>(null);

  // Handle loading a saved palette
  const handlePaletteLoad = (palette: {
    pokemonId: number;
    isShiny: boolean;
    colors: string[];
  }) => {
    setSelectedPokemonId(palette.pokemonId);
    setIsShiny(palette.isShiny);
    setPokemonColors(palette.colors);
    setSelectedVarietyId(null); // Reset variety when loading a palette
    setSelectedFormName(null); // Reset form when loading a palette
  };

  // Persist the collapsed state to the same cookie the server reads
  // on next render. We deliberately don't seed from localStorage
  // here — the cookie is now the source of truth, set on mount via
  // the server prop above. Migrating any pre-cookie localStorage
  // values is left to the browser's natural cookie eviction; the
  // worst case is one extra mouse-click per returning user.
  useEffect(() => {
    writePokemonMenuCookie(isPokemonMenuCollapsed);
  }, [isPokemonMenuCollapsed]);

  return (
    <main id="main" className="flex flex-col h-screen overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <CoffeeCTA primaryColor={pokemonColors[0]} />
        <CollapsibleSidebar primaryColor={pokemonColors[0]} />
        {/* Single scroll container on desktop so `md:sticky` on the menu has
            something to stick to. (Previously each column had its own
            overflow-auto, which pinned the menu visually but was fragile -
            any child overflowing its column let the menu scroll with the
            page.) */}
        <div className="flex-1 flex flex-col md:flex-row h-full overflow-y-auto overflow-x-hidden md:items-start">
        {/* Pokemon Menu - Full width on mobile, sticky-left on desktop.
            Collapsed width (md:w-16) matches the main navigation sidebar so
            the two rails align into a single shell. */}
        <div className={`${
          isPokemonMenuCollapsed 
            ? "hidden md:block md:w-16" 
            : "w-full md:w-1/4"
        } h-auto md:h-screen md:sticky md:top-0 md:self-start md:flex-shrink-0 flex flex-col md:flex-row transition-all duration-300`}>
          <PokemonMenu
            onPokemonSelect={setSelectedPokemonId}
            isShiny={isShiny}
            onShinyToggle={setIsShiny}
            onColorsExtracted={setPokemonColors}
            isCollapsed={isPokemonMenuCollapsed}
            onToggleCollapse={setIsPokemonMenuCollapsed}
            selectedPokemonId={selectedPokemonId}
            onVarietySelect={setSelectedVarietyId}
            selectedVarietyId={selectedVarietyId}
            onFormSelect={setSelectedFormName}
            selectedFormName={selectedFormName}
          />
          {/* Separator line - horizontal on mobile, vertical on desktop */}
          {!isPokemonMenuCollapsed && (
            <div className="h-px md:h-auto md:w-px bg-border flex-shrink-0" />
          )}
        </div>

        {/* Hero/Example Page with Footer - grows naturally; the parent
            handles scroll on desktop, the sticky menu stays pinned. */}
        <div className={`${
          isPokemonMenuCollapsed 
            ? "w-full" 
            : "w-full md:w-3/4"
        } flex flex-col h-auto px-0 transition-all duration-300 md:min-w-0`}>
          <PokemonHero
            pokemonId={selectedPokemonId}
            isShiny={isShiny}
            onImageSrcChange={setCurrentImageSrc}
            colors={pokemonColors}
            onPaletteLoad={handlePaletteLoad}
            varietyId={selectedVarietyId}
            formName={selectedFormName}
          />
          {pokemonColors.length > 0 && (
            <>
              <PokemonPaletteDisplay colors={pokemonColors} />
              <PokemonCard
                pokemonId={selectedPokemonId}
                isShiny={isShiny}
                colors={pokemonColors}
                varietyId={selectedVarietyId}
                formName={selectedFormName}
              />
              {pokemonColors[0] && (
                <ColorShowcase
                  primaryColor={pokemonColors[0]}
                  secondaryColor={pokemonColors[1] || pokemonColors[0]}
                />
              )}
              <ThemeExporter colors={pokemonColors} />
              {/* Below-the-fold ad on `/`. Only mounts once the user has
                  actually generated a palette (pokemonColors.length > 0
                  gate above), which keeps the tool itself ad-free on
                  first load and respects AdSense policy around app-like
                  interactive surfaces. allowOnDeniedRoute opts past the
                  global guard that suppresses ads on `/`. */}
              <AdUnit
                slot={ADSENSE_SLOTS.homeBelowTool}
                allowOnDeniedRoute
                className="mt-8 px-4 md:px-12"
                style={{ display: "block", minHeight: 280 }}
              />
            </>
          )}
          <Footer />
        </div>
      </div>
      </div>
    </main>
  );
}

