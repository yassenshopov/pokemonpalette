"use client";

import Image from "next/image";
import { Pokemon } from "@/types/pokemon";

interface EvolutionChainProps {
  pokemon: Pokemon;
  isShiny: boolean;
  onPokemonSelect: (pokemonId: number) => void;
}

export function PokemonEvolutionChain({
  pokemon,
  isShiny,
  onPokemonSelect,
}: EvolutionChainProps) {
  if (!pokemon.evolution || !Array.isArray(pokemon.evolution)) {
    return (
      <div className="text-sm text-muted-foreground">
        No evolution data available
      </div>
    );
  }

  const handleEvolutionClick = (evoName: string) => {
    // Find Pokemon by name in the evolution chain
    // You'll need to pass the pokemonList or create a lookup function
    // For now, this is a placeholder
    console.log("Evolution clicked:", evoName);
  };

  return (
    <div className="flex flex-col gap-3">
      {pokemon.evolution.map((evo, index) => {
        // For now, we'll use the current pokemon's sprite data
        // In a real implementation, you'd fetch the evolution's sprite
        const isLast = index === pokemon.evolution.length - 1;

        return (
          <div key={index} className="flex items-center gap-3">
            {/* Evolution Pokemon */}
            <div className="flex flex-col items-center gap-1">
              {/* Placeholder for sprite - you'd load evo sprite here */}
              <div className="w-12 h-12 bg-muted rounded flex items-center justify-center text-xs">
                #{index + 1}
              </div>
              <span className="text-xs text-center max-w-[60px] truncate">
                {evo.name}
              </span>
            </div>

            {/* Arrow */}
            {!isLast && (
              <div className="flex-1 flex items-center">
                <div className="flex-1 border-t border-border" />
                <ChevronDown className="w-4 h-4 mx-1 text-muted-foreground" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}
