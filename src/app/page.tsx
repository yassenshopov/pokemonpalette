"use client";

import { useState } from "react";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { PokemonMenu } from "@/components/pokemon-menu";
import { PokemonHero } from "@/components/pokemon-hero";
import { Footer } from "@/components/footer";

export default function Home() {
  const [selectedPokemonId, setSelectedPokemonId] = useState<number | null>(
    null
  );
  const [isShiny, setIsShiny] = useState(false);

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
          />
          {/* Vertical separator line */}
          <div className="w-px bg-border flex-shrink-0" />
        </div>

        {/* Right 3/4 - Hero/Example Page with Footer */}
        <div className="w-3/4 flex flex-col h-full overflow-auto px-0">
          <PokemonHero pokemonId={selectedPokemonId} isShiny={isShiny} />
          <Footer />
        </div>
      </div>
    </div>
  );
}
