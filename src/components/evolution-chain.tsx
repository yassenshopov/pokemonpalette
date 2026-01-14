"use client";

import { Pokemon } from "@/types/pokemon";
import { getPokemonMetadataByName } from "@/lib/pokemon";
import { getFrontSpriteUrl } from "@/lib/sprite-utils";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";

interface EvolutionChainProps {
  pokemonData: Pokemon;
  selectedPokemon: number | null;
  isShiny: boolean;
  extractedColors: string[];
  onPokemonSelect: (pokemonId: number) => void;
}

export function EvolutionChain({
  pokemonData,
  selectedPokemon,
  isShiny,
  extractedColors,
  onPokemonSelect,
}: EvolutionChainProps) {
  if (!pokemonData.evolution || !Array.isArray(pokemonData.evolution) || pokemonData.evolution.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      {(() => {
        // Group evolutions by level to detect branches
        const evosByLevel: {
          [level: number]: typeof pokemonData.evolution;
        } = {};
        pokemonData.evolution.forEach((evo) => {
          if (!evosByLevel[evo.level]) {
            evosByLevel[evo.level] = [];
          }
          evosByLevel[evo.level].push(evo);
        });

        const levels = Object.keys(evosByLevel)
          .map(Number)
          .sort((a, b) => a - b);

        return levels.flatMap((level, levelIndex) => {
          const evosAtLevel = evosByLevel[level];
          const isLastLevel = levelIndex === levels.length - 1;
          const isBranch = evosAtLevel.length > 1;

          return [
            // Evolution cards at this level - horizontal if branch
            <div
              key={`level-${level}`}
              className={`${
                isBranch
                  ? "flex flex-wrap justify-center gap-2"
                  : "flex justify-center"
              }`}
            >
              {evosAtLevel.map((evo, evoIndex) => {
                const evoMetadata = getPokemonMetadataByName(evo.name);
                const fallbackUrl = evoMetadata?.id
                  ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${
                      isShiny ? "shiny/" : ""
                    }${evoMetadata.id}.png`
                  : null;
                const evoSprite = evoMetadata?.id
                  ? getFrontSpriteUrl(evoMetadata.id, isShiny, fallbackUrl)
                  : null;
                const isSelected = evoMetadata?.id === selectedPokemon;

                return (
                  <div
                    key={`${level}-${evoIndex}`}
                    className="flex flex-col items-center"
                  >
                    {/* Evolution Pokemon */}
                    <button
                      onClick={() => {
                        if (evoMetadata) {
                          onPokemonSelect(evoMetadata.id);
                        }
                      }}
                      className={`flex flex-col items-center gap-0.5 hover:opacity-80 transition-all cursor-pointer p-1 rounded ${
                        isSelected ? "ring-2" : ""
                      }`}
                      style={
                        isSelected
                          ? {
                              borderColor:
                                (extractedColors[0] ||
                                  pokemonData.colorPalette?.primary ||
                                  "#000") + "80",
                              backgroundColor:
                                (extractedColors[0] ||
                                  pokemonData.colorPalette?.primary ||
                                  "#000") + "15",
                            }
                          : {}
                      }
                    >
                      {evoSprite ? (
                        <EvolutionSprite
                          src={evoSprite}
                          fallbackUrl={fallbackUrl}
                          alt={evo.name}
                          width={isBranch ? 48 : 64}
                          height={isBranch ? 48 : 64}
                          className={`${
                            isBranch ? "w-12 h-12" : "w-16 h-16"
                          } object-contain`}
                        />
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center text-xs">
                          ?
                        </div>
                      )}
                      <div
                        className={`flex items-center ${
                          isBranch
                            ? "flex-col gap-0"
                            : "flex-row gap-1"
                        }`}
                      >
                        <span
                          className={`${
                            isBranch ? "text-[10px]" : "text-xs"
                          } text-muted-foreground`}
                        >
                          #{evoMetadata?.id || "?"}
                        </span>
                        <span
                          className={`${
                            isBranch
                              ? "text-[10px] max-w-[60px]"
                              : "text-xs max-w-[80px]"
                          } font-medium text-center truncate`}
                        >
                          {evo.name}
                        </span>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>,
            // Arrow between levels
            !isLastLevel && (
              <ChevronDown
                key={`arrow-${level}`}
                className="w-4 h-4"
              />
            ),
          ].filter(Boolean);
        });
      })()}
      
      {/* Show "Single Stage" text if only one evolution entry */}
      {pokemonData.evolution.length === 1 && (
        <div className="flex justify-center pt-2">
          <span className="text-sm text-muted-foreground">
            Single Stage
          </span>
        </div>
      )}
    </div>
  );
}

// Component to handle sprite with fallback
function EvolutionSprite({
  src,
  fallbackUrl,
  alt,
  width,
  height,
  className,
}: {
  src: string;
  fallbackUrl: string | null;
  alt: string;
  width: number;
  height: number;
  className?: string;
}) {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  // Update imgSrc when src prop changes (e.g., when isShiny toggles)
  useEffect(() => {
    setImgSrc(src);
    setHasError(false);
  }, [src]);

  const handleError = () => {
    if (!hasError && fallbackUrl && imgSrc !== fallbackUrl) {
      setHasError(true);
      setImgSrc(fallbackUrl);
    }
  };

  return (
    <Image
      key={imgSrc}
      src={imgSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={{
        imageRendering: "pixelated",
      }}
      unoptimized
      onError={handleError}
    />
  );
}
