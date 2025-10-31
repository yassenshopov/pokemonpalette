"use client";

import { useState } from "react";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { PokemonMenu } from "@/components/pokemon-menu";
import { PokemonHero } from "@/components/pokemon-hero";
import { PokemonPaletteDisplay } from "@/components/pokemon-palette-display";
import { PokemonCard } from "@/components/pokemon-card";
import { ColorShowcase } from "@/components/color-showcase";
import { Footer } from "@/components/footer";
import { CoffeeCTA } from "@/components/coffee-cta";

export default function Home() {
  const [selectedPokemonId, setSelectedPokemonId] = useState<number | null>(
    null
  );
  const [isShiny, setIsShiny] = useState(false);
  const [currentImageSrc, setCurrentImageSrc] = useState<string | null>(null);
  const [pokemonColors, setPokemonColors] = useState<string[]>([]);

  return (
    <div className="flex h-screen overflow-hidden">
      <CoffeeCTA primaryColor={pokemonColors[0]} />
      <CollapsibleSidebar primaryColor={pokemonColors[0]} />
      <div className="flex-1 flex flex-col md:flex-row h-full overflow-auto md:overflow-hidden">
        {/* Pokemon Menu - Full width on mobile, 1/4 width on desktop */}
        <div className="w-full md:w-1/4 h-auto md:h-full flex flex-col md:flex-row">
          <PokemonMenu
            onPokemonSelect={setSelectedPokemonId}
            isShiny={isShiny}
            onShinyToggle={setIsShiny}
            onColorsExtracted={setPokemonColors}
          />
          {/* Separator line - horizontal on mobile, vertical on desktop */}
          <div className="h-px md:h-auto md:w-px bg-border flex-shrink-0" />
        </div>

        {/* Hero/Example Page with Footer - Full width on mobile, 3/4 width on desktop */}
        <div className="w-full md:w-3/4 flex flex-col h-auto md:h-full md:overflow-auto px-0">
          <PokemonHero
            pokemonId={selectedPokemonId}
            isShiny={isShiny}
            onImageSrcChange={setCurrentImageSrc}
            colors={pokemonColors}
          />
          {pokemonColors.length > 0 && (
            <>
              <PokemonPaletteDisplay colors={pokemonColors} />
              <PokemonCard
                pokemonId={selectedPokemonId}
                isShiny={isShiny}
                colors={pokemonColors}
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
