"use client";

import { useState, useEffect, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { writePokemonMenuCookie } from "@/lib/pokemon-menu-cookie";
import { PokemonMenu } from "@/components/pokemon-menu";
import { PokemonHero } from "@/components/pokemon-hero";
import { PokemonPaletteDisplay } from "@/components/pokemon-palette-display";
import { Footer } from "@/components/footer";
import { AdUnit, ADSENSE_SLOTS } from "@/components/analytics/google-adsense";
import { PokemonMetadata } from "@/types/pokemon";

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

interface ShinyPokemonPageClientProps {
  pokemonMetadata: PokemonMetadata;
  breadcrumbs?: ReactNode;
  /** Server-seeded initial value for the Pokémon-menu collapsed
   *  state, read from the shared `pokemon_menu_collapsed` cookie. */
  initialMenuCollapsed?: boolean;
}

export function ShinyPokemonPageClient({
  pokemonMetadata,
  breadcrumbs,
  initialMenuCollapsed = false,
}: ShinyPokemonPageClientProps) {
  const [selectedPokemonId, setSelectedPokemonId] = useState<number | null>(
    pokemonMetadata?.id ?? null
  );
  // Shiny pages render is forced to true and never toggles.
  const isShiny = true;
  const [, setCurrentImageSrc] = useState<string | null>(null);
  const [pokemonColors, setPokemonColors] = useState<string[]>([]);
  const [isPokemonMenuCollapsed, setIsPokemonMenuCollapsed] = useState(
    initialMenuCollapsed,
  );
  const [selectedVarietyId, setSelectedVarietyId] = useState<number | null>(
    null
  );
  const [selectedFormName, setSelectedFormName] = useState<string | null>(null);

  // Handle loading a saved palette
  const handlePaletteLoad = (palette: {
    pokemonId: number;
    isShiny: boolean;
    colors: string[];
  }) => {
    setSelectedPokemonId(palette.pokemonId);
    // Note: isShiny is forced to true, but we still update colors
    setPokemonColors(palette.colors);
    setSelectedVarietyId(null); // Reset variety when loading a palette
    setSelectedFormName(null); // Reset form when loading a palette
  };

  // Persist to BOTH localStorage (legacy) and the cookie (new).
  // Shiny pages are statically generated (1000+ entries) so we can't
  // read the cookie server-side without opting them out of SSG;
  // instead we mirror the value in localStorage and seed from there
  // on mount. There's still a one-frame flash for returning visitors,
  // but the home page (the dominant entry point) is fully fixed via
  // the server prop, so the surface area shrinks dramatically.
  useEffect(() => {
    writePokemonMenuCookie(isPokemonMenuCollapsed);
    try {
      localStorage.setItem(
        "pokemon-menu-collapsed",
        JSON.stringify(isPokemonMenuCollapsed),
      );
    } catch {
      // localStorage blocked (Safari private mode, storage full); fall
      // through silently — the cookie write still happened.
    }
  }, [isPokemonMenuCollapsed]);

  // Seed from localStorage exactly once on mount. Defensive parse so
  // a corrupt value (someone hand-edited storage, a previous bug
  // wrote junk) doesn't crash the page.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("pokemon-menu-collapsed");
      if (raw === null) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed === "boolean") setIsPokemonMenuCollapsed(parsed);
    } catch {
      // Bad value — drop it so we don't keep tripping on it.
      try {
        localStorage.removeItem("pokemon-menu-collapsed");
      } catch {}
    }
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <CoffeeCTA primaryColor={pokemonColors[0]} />
      <CollapsibleSidebar primaryColor={pokemonColors[0]} />
      <div className="flex-1 flex flex-col md:flex-row h-full overflow-auto md:overflow-hidden">
        {/* Pokemon Menu - Full width on mobile, collapsible on desktop */}
        <div
          className={`${
            isPokemonMenuCollapsed
              ? "hidden md:block md:w-auto"
              : "w-full md:w-1/4"
          } h-auto md:h-full flex flex-col md:flex-row transition-all duration-300`}
        >
          <PokemonMenu
            onPokemonSelect={setSelectedPokemonId}
            isShiny={isShiny}
            onShinyToggle={() => {}} // Disabled for shiny pages
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

        {/* Hero/Example Page with Footer - Full width on mobile, responsive width on desktop */}
        <div
          className={`${
            isPokemonMenuCollapsed ? "w-full" : "w-full md:w-3/4"
          } relative flex flex-col h-auto md:h-full md:overflow-auto px-0 transition-all duration-300`}
        >
          {breadcrumbs && (
            <div className="absolute top-3 left-4 md:left-12 z-20 max-w-[calc(100%-2rem)]">
              {breadcrumbs}
            </div>
          )}
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
              <ThemeExporter
                colors={pokemonColors}
                pokemonName={
                  pokemonMetadata.name
                    ? `${pokemonMetadata.name}-shiny`
                    : undefined
                }
              />
              {/* Shares the in-article fluid slot with the non-shiny
                  detail page — same unit, same configuration. See the
                  comment in pokemon-page-client.tsx for details. */}
              <AdUnit
                slot={ADSENSE_SLOTS.pokemonDetailInArticle}
                format="fluid"
                layout="in-article"
                className="mt-8 px-4 md:px-12"
                style={{
                  display: "block",
                  textAlign: "center",
                  minHeight: 280,
                }}
              />
            </>
          )}
          <Footer />
        </div>
      </div>
    </div>
  );
}
