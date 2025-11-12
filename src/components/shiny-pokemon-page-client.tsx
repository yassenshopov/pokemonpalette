"use client";

import { useState, useEffect } from "react";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { PokemonMenu } from "@/components/pokemon-menu";
import { PokemonHero } from "@/components/pokemon-hero";
import { PokemonPaletteDisplay } from "@/components/pokemon-palette-display";
import { PokemonCard } from "@/components/pokemon-card";
import { ColorShowcase } from "@/components/color-showcase";
import { Footer } from "@/components/footer";
import { CoffeeCTA } from "@/components/coffee-cta";
import { PokemonMetadata } from "@/types/pokemon";

interface ShinyPokemonPageClientProps {
  pokemonMetadata: PokemonMetadata;
}

export function ShinyPokemonPageClient({
  pokemonMetadata,
}: ShinyPokemonPageClientProps) {
  const [selectedPokemonId, setSelectedPokemonId] = useState<number | null>(
    pokemonMetadata?.id ?? null
  );
  // Force shiny mode to true for shiny pages
  const [isShiny] = useState(true);
  const [currentImageSrc, setCurrentImageSrc] = useState<string | null>(null);
  const [pokemonColors, setPokemonColors] = useState<string[]>([]);
  const [isPokemonMenuCollapsed, setIsPokemonMenuCollapsed] = useState(false);
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

  // Load Pokemon menu collapsed state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem("pokemon-menu-collapsed");
    if (savedState !== null) {
      setIsPokemonMenuCollapsed(JSON.parse(savedState));
    }
  }, []);

  // Save Pokemon menu collapsed state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(
      "pokemon-menu-collapsed",
      JSON.stringify(isPokemonMenuCollapsed)
    );
  }, [isPokemonMenuCollapsed]);

  return (
    <div className="flex h-screen overflow-hidden">
      <CoffeeCTA primaryColor={pokemonColors[0]} />
      <CollapsibleSidebar
        primaryColor={pokemonColors[0]}
        onPaletteLoad={handlePaletteLoad}
      />
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
          } flex flex-col h-auto md:h-full md:overflow-auto px-0 transition-all duration-300`}
        >
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
              <ColorShowcase
                primaryColor={pokemonColors[0]}
                secondaryColor={pokemonColors[1] || pokemonColors[0]}
              />
            </>
          )}
          <Footer />
        </div>
      </div>
    </div>
  );
}
