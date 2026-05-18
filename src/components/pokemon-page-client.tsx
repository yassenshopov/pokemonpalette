"use client";

import { useState, useEffect, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
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

interface PokemonPageClientProps {
  pokemonMetadata: PokemonMetadata;
  breadcrumbs?: ReactNode;
  // Server-rendered, visible SEO content slot. Lives between the hero and
  // the interactive palette UI so Googlebot finds substantive,
  // per-Pokemon prose + internal links in the initial HTML (the previous
  // sr-only block was getting discounted as hidden content). Visible to
  // users too — it acts as a "more about this Pokémon" section.
  infoSection?: ReactNode;
}

export function PokemonPageClient({
  pokemonMetadata,
  breadcrumbs,
  infoSection,
}: PokemonPageClientProps) {
  const [selectedPokemonId, setSelectedPokemonId] = useState<number | null>(
    pokemonMetadata?.id ?? null
  );
  const [isShiny, setIsShiny] = useState(false);
  const [, setCurrentImageSrc] = useState<string | null>(null);
  const [pokemonColors, setPokemonColors] = useState<string[]>([]);
  const [isPokemonMenuCollapsed, setIsPokemonMenuCollapsed] = useState(false);
  const [selectedVarietyId, setSelectedVarietyId] = useState<number | null>(null);
  const [selectedFormName, setSelectedFormName] = useState<string | null>(null);

  // If Pokemon not found, show 404
  useEffect(() => {
    if (!pokemonMetadata) {
      notFound();
    }
  }, [pokemonMetadata]);

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

  // Load Pokemon menu collapsed state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem("pokemon-menu-collapsed");
    if (savedState !== null) {
      setIsPokemonMenuCollapsed(JSON.parse(savedState));
    }
  }, []);

  // Save Pokemon menu collapsed state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("pokemon-menu-collapsed", JSON.stringify(isPokemonMenuCollapsed));
  }, [isPokemonMenuCollapsed]);

  // If Pokemon not found, return null while notFound() is being called
  if (!pokemonMetadata) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <CoffeeCTA primaryColor={pokemonColors[0]} />
      <CollapsibleSidebar primaryColor={pokemonColors[0]} />
      {/* Single scroll container on desktop so `md:sticky` on the menu has
          something to stick to. (The previous overflow-hidden + per-column
          overflow-auto setup pinned the menu visually but was fragile -
          any child accidentally growing past its column would let the menu
          scroll along with the page.) */}
      <div className="flex-1 flex flex-col md:flex-row h-full overflow-y-auto overflow-x-hidden md:items-start">
        {/* Pokemon Menu - Full width on mobile, sticky-left on desktop */}
        <div className={`${
          isPokemonMenuCollapsed 
            ? "hidden md:block md:w-auto" 
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
        } relative flex flex-col h-auto px-0 transition-all duration-300 md:min-w-0`}>
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
          {infoSection}
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
                pokemonName={pokemonMetadata.name}
              />
              {/* In-article fluid unit — slot configured in AdSense as
                  data-ad-layout="in-article" / data-ad-format="fluid".
                  Style mirrors Google's official snippet (centered fluid
                  block). minHeight reserves vertical space pre-fill to
                  avoid CLS while inventory is still ramping up. */}
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

