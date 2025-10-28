"use client";

import { useState } from "react";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { PokemonMenu } from "@/components/pokemon-menu";
import { PokemonHero } from "@/components/pokemon-hero";
import { PokemonPaletteDisplay } from "@/components/pokemon-palette-display";
import { SupportersDisplay } from "@/components/supporters-display";
import { ColorShowcase } from "@/components/color-showcase";
import { Footer } from "@/components/footer";

export default function Home() {
  const [selectedPokemonId, setSelectedPokemonId] = useState<number | null>(
    null
  );
  const [isShiny, setIsShiny] = useState(false);
  const [currentImageSrc, setCurrentImageSrc] = useState<string | null>(null);
  const [pokemonColors, setPokemonColors] = useState<string[]>([]);

  return (
    <div className="flex h-screen">
      <CollapsibleSidebar />
      <div className="flex-1 flex h-full overflow-hidden">
        {/* Left 1/4 - Pokemon Menu */}
        <div className="w-1/4 h-full flex">
          <PokemonMenu
            onPokemonSelect={setSelectedPokemonId}
            isShiny={isShiny}
            onShinyToggle={setIsShiny}
            onColorsExtracted={setPokemonColors}
          />
          {/* Vertical separator line */}
          <div className="w-px bg-border flex-shrink-0" />
        </div>

        {/* Right 3/4 - Hero/Example Page with Footer */}
        <div className="w-3/4 flex flex-col h-full overflow-auto px-0">
          <PokemonHero
            pokemonId={selectedPokemonId}
            isShiny={isShiny}
            onImageSrcChange={setCurrentImageSrc}
            colors={pokemonColors}
          />
          {pokemonColors.length > 0 && (
            <>
              <PokemonPaletteDisplay colors={pokemonColors} />
              <SupportersDisplay 
                primaryColor={pokemonColors[0]} 
                secondaryColor={pokemonColors[1] || pokemonColors[0]} 
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
