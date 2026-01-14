"use client";

import { useState, useEffect, useRef } from "react";
import { Pokemon } from "@/types/pokemon";
import { getPokemonById } from "@/lib/pokemon";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ExternalLink, Volume2, VolumeX } from "lucide-react";
import { POKEMON_CONSTANTS } from "@/constants/pokemon";
import { getOfficialArtworkUrl } from "@/lib/sprite-utils";

// Helper function to determine if text should be dark or light based on background
const getTextColor = (hex: string): "text-white" | "text-black" => {
  const hexClean = hex.replace("#", "");
  const r = parseInt(hexClean.substring(0, 2), 16);
  const g = parseInt(hexClean.substring(2, 4), 16);
  const b = parseInt(hexClean.substring(4, 6), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return white for dark colors, black for light colors
  return luminance > 0.5 ? "text-black" : "text-white";
};

// We'll use theme colors instead of custom type colors

interface PokemonCardProps {
  pokemonId: number | null;
  isShiny?: boolean;
  colors?: string[];
  varietyId?: number | null;
  formName?: string | null;
}

export function PokemonCard({
  pokemonId,
  isShiny = false,
  colors = [],
  varietyId,
  formName,
}: PokemonCardProps) {
  const [pokemon, setPokemon] = useState<Pokemon | null>(null);
  const [basePokemon, setBasePokemon] = useState<Pokemon | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPlayingCry, setIsPlayingCry] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load base Pokemon data for description
  useEffect(() => {
    if (pokemonId) {
      getPokemonById(pokemonId)
        .then((data) => {
          setBasePokemon(data);
        })
        .catch((error) => {
          console.error("Failed to load base Pokemon:", error);
        });
    } else {
      setBasePokemon(null);
    }
  }, [pokemonId]);

  // Load Pokemon data - use varietyId if provided, otherwise use pokemonId
  useEffect(() => {
    const idToLoad = varietyId || pokemonId;
    if (idToLoad) {
      setLoading(true);
      setIsVisible(false);
      getPokemonById(idToLoad)
        .then((data) => {
          setPokemon(data);
          // Smooth fade in after data loads
          setTimeout(() => setIsVisible(true), 100);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setPokemon(null);
    }
  }, [pokemonId, varietyId]);

  const playCry = () => {
    if (pokemon?.cries?.latest && !isPlayingCry) {
      setIsPlayingCry(true);

      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      audioRef.current = new Audio(pokemon.cries.latest);
      audioRef.current.volume = 0.3; // Set volume to 30%

      audioRef.current.onended = () => {
        setIsPlayingCry(false);
      };

      audioRef.current.onerror = () => {
        setIsPlayingCry(false);
        console.error("Failed to play Pokémon cry");
      };

      audioRef.current.play().catch(() => {
        setIsPlayingCry(false);
        console.error("Failed to play Pokémon cry");
      });
    }
  };

  const stopCry = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlayingCry(false);
    }
  };

  const getBulbapediaUrl = (pokemonName: string) => {
    return `https://bulbapedia.bulbagarden.net/wiki/${pokemonName.replace(
      /\s+/g,
      "_"
    )}_(Pokémon)`;
  };

  const getOfficialArtwork = (pokemon: Pokemon) => {
    // If a form is selected, construct the artwork URL from the form name
    if (formName) {
      const fallbackUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork${
        isShiny ? "/shiny" : ""
      }/${pokemon.id}-${formName}.png`;
      // Try local path first (forms use {id}-{formName}.png naming)
      const localPath = `/pokemon/${isShiny ? "shiny/" : ""}${pokemon.id}-${formName}.png`;
      return localPath; // Try local first, browser will fallback on error
    }
    
    // If a variety is selected, construct the artwork URL from the variety ID
    if (varietyId) {
      const fallbackUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork${
        isShiny ? "/shiny" : ""
      }/${varietyId}.png`;
      return getOfficialArtworkUrl(varietyId, isShiny, fallbackUrl);
    }
    
    // Otherwise, use the Pokemon's artwork with shiny support
    if (typeof pokemon.artwork === "object" && "official" in pokemon.artwork) {
      let artworkUrl = pokemon.artwork.official;
      if (isShiny) {
        // Handle both PokeAPI URLs and local paths
        if (artworkUrl.startsWith("/pokemon/") && !artworkUrl.includes("/shiny/")) {
          // Local path: /pokemon/10282.png -> /pokemon/shiny/10282.png
          artworkUrl = artworkUrl.replace("/pokemon/", "/pokemon/shiny/");
        } else if (artworkUrl.includes("/other/official-artwork/")) {
          // PokeAPI URL: replace the path segment
          artworkUrl = artworkUrl.replace(
            "/other/official-artwork/",
            "/other/official-artwork/shiny/"
          );
        }
      }
      return artworkUrl;
    }
    return null;
  };

  const primaryColor = colors[0] || pokemon?.colorPalette?.primary || "#6366f1";
  const secondaryColor =
    colors[1] || pokemon?.colorPalette?.secondary || "#8b5cf6";

  if (loading || !pokemon) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 md:px-12 py-6 md:py-12">
        <div
          className="relative overflow-hidden rounded-2xl border p-4 md:p-8 transition-all duration-500 ease-out"
          style={{
            background: `linear-gradient(135deg, ${primaryColor}15 0%, ${secondaryColor}10 100%)`,
          }}
        >
          <div className="animate-pulse">
            <div className="h-8 bg-muted/30 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-muted/30 rounded w-2/3 mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
              <div className="space-y-4">
                <div className="h-4 bg-muted/30 rounded w-1/4"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-muted/30 rounded"></div>
                  <div className="h-3 bg-muted/30 rounded w-5/6"></div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="h-4 bg-muted/30 rounded w-1/4"></div>
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <div className="h-3 bg-muted/30 rounded w-1/3"></div>
                      <div className="h-2 bg-muted/30 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const officialArtwork = getOfficialArtwork(pokemon);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 md:px-12 py-6 md:py-12">
      <div
        className={`relative overflow-hidden rounded-2xl border p-4 md:p-8 transition-all duration-500 ease-out ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
        style={{
          background: `linear-gradient(135deg, ${primaryColor}15 0%, ${secondaryColor}10 100%)`,
        }}
      >
        {/* Background silhouette - positioned on the right */}
        {officialArtwork && (
          <div className="absolute top-0 right-0 w-40 md:w-80 h-full flex items-center justify-center opacity-10 pointer-events-none overflow-hidden">
            <div
              className="w-40 h-40 md:w-80 md:h-80"
              style={{
                backgroundColor: primaryColor,
                maskImage: `url(${officialArtwork})`,
                maskSize: "contain",
                maskRepeat: "no-repeat",
                maskPosition: "center",
                WebkitMaskImage: `url(${officialArtwork})`,
                WebkitMaskSize: "contain",
                WebkitMaskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
              }}
            />
          </div>
        )}

        {/* Content */}
        <div className="relative z-10">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start justify-between mb-4 md:mb-6 gap-3">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                <h2 className="text-2xl md:text-3xl font-bold font-heading">
                  {pokemon.name}
                </h2>
                <span className="text-base md:text-lg text-muted-foreground">
                  #{pokemon.id.toString().padStart(3, "0")}
                </span>
              </div>
              <p className="text-muted-foreground mb-4">
                {pokemon.species.toLowerCase().startsWith("the")
                  ? pokemon.species
                  : `The ${pokemon.species}`}
              </p>

              {/* Types */}
              <div className="flex gap-2 mb-4">
                {pokemon.type.map((type, index) => (
                  <Badge
                    key={type}
                    className="font-medium"
                    style={{
                      backgroundColor:
                        colors[index % colors.length] || primaryColor,
                      color:
                        getTextColor(
                          colors[index % colors.length] || primaryColor
                        ) === "text-white"
                          ? "#ffffff"
                          : "#000000",
                    }}
                  >
                    {type}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-2">
              {pokemon.cries?.latest && (
                <Button
                  onClick={isPlayingCry ? stopCry : playCry}
                  variant="outline"
                  size="sm"
                  className="cursor-pointer w-full sm:w-auto"
                  style={{
                    borderColor: primaryColor + "40",
                    backgroundColor: isPlayingCry
                      ? primaryColor + "20"
                      : "transparent",
                  }}
                >
                  {isPlayingCry ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </Button>
              )}

              <Button
                asChild
                variant="outline"
                size="sm"
                className="cursor-pointer w-full sm:w-auto"
                style={{
                  borderColor: primaryColor + "40",
                }}
              >
                <a
                  href={getBulbapediaUrl(pokemon.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  Learn More
                </a>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
            {/* Left column - Flavor text and basic info */}
            <div
              className={`space-y-4 md:space-y-6 transition-all duration-700 ease-out delay-100 ${
                isVisible
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 -translate-x-4"
              }`}
            >
              {/* Flavor text */}
              <div>
                <h3 className="text-base md:text-lg font-semibold mb-2 md:mb-3">
                  Pokédex Entry
                </h3>
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                  {(basePokemon?.description || pokemon?.description) || "No description available."}
                </p>
              </div>

              {/* Physical characteristics */}
              <div>
                <h3 className="text-base md:text-lg font-semibold mb-2 md:mb-3">
                  Physical Traits
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">
                      Height
                    </span>
                    <span className="font-medium">{pokemon.height} m</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">
                      Weight
                    </span>
                    <span className="font-medium">{pokemon.weight} kg</span>
                  </div>
                </div>
              </div>

              {/* Abilities */}
              <div>
                <h3 className="text-base md:text-lg font-semibold mb-2 md:mb-3">
                  Abilities
                </h3>
                <div className="space-y-2">
                  {Array.isArray(pokemon.abilities) &&
                    pokemon.abilities.map((ability, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Badge
                          className={`font-medium ${
                            typeof ability === "object" && ability.is_hidden
                              ? "opacity-70"
                              : ""
                          }`}
                          style={{
                            backgroundColor:
                              colors[
                                (index + pokemon.type.length) % colors.length
                              ] || secondaryColor,
                            color:
                              getTextColor(
                                colors[
                                  (index + pokemon.type.length) % colors.length
                                ] || secondaryColor
                              ) === "text-white"
                                ? "#ffffff"
                                : "#000000",
                          }}
                        >
                          {typeof ability === "string" ? ability : ability.name}
                          {typeof ability === "object" && ability.is_hidden && (
                            <span className="ml-1 text-xs">(Hidden)</span>
                          )}
                        </Badge>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Right column - Stats */}
            <div
              className={`transition-all duration-700 ease-out delay-200 ${
                isVisible
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 translate-x-4"
              }`}
            >
              <h3 className="text-base md:text-lg font-semibold mb-2 md:mb-3">
                Base Stats
              </h3>
              <div className="space-y-3">
                {Object.entries(pokemon.baseStats).map(([statName, value]) => {
                  const displayName = statName
                    .replace(/([A-Z])/g, " $1")
                    .replace(/^./, (str) => str.toUpperCase())
                    .replace("Special Attack", "Sp. Atk")
                    .replace("Special Defense", "Sp. Def");

                  const maxStat = POKEMON_CONSTANTS.MAX_BASE_STAT;
                  const percentage = (value / maxStat) * 100;

                  return (
                    <div key={statName} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">
                          {displayName}
                        </span>
                        <span className="text-sm font-bold">{value}</span>
                      </div>
                      <div className="relative">
                        <Progress
                          value={percentage}
                          className="h-2"
                          style={{
                            backgroundColor: primaryColor + "20",
                          }}
                        />
                        {/* Custom progress indicator overlay */}
                        <div
                          className="absolute top-0 left-0 h-full rounded-full transition-all"
                          style={{
                            backgroundColor: primaryColor,
                            width: `${percentage}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Total stats */}
                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold">
                      {Object.values(pokemon.baseStats).reduce(
                        (sum, stat) => sum + stat,
                        0
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
