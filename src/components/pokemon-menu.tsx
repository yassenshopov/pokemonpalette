"use client";

import { useState, useEffect, useRef } from "react";
import {
  getAllPokemonMetadata,
  getPokemonById,
  getPokemonMetadataByName,
} from "@/lib/pokemon";
import { extractColorsFromImage } from "@/lib/color-extractor";
import { Pokemon } from "@/types/pokemon";
import Image from "next/image";
import { LoaderOverlay } from "@/components/loader-overlay";
import { PokemonSearch } from "@/components/pokemon-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Shuffle, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

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

// Helper function to convert colors
const convertColor = (hex: string, format: "hex" | "hsl" | "rgb"): string => {
  if (format === "hex") return hex;

  // Remove # if present
  const hexClean = hex.replace("#", "");
  const r = parseInt(hexClean.substring(0, 2), 16);
  const g = parseInt(hexClean.substring(2, 4), 16);
  const b = parseInt(hexClean.substring(4, 6), 16);

  if (format === "rgb") {
    return `rgb(${r}, ${g}, ${b})`;
  }

  // Convert to HSL
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0,
    s = 0,
    l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm:
        h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6;
        break;
      case gNorm:
        h = ((bNorm - rNorm) / d + 2) / 6;
        break;
      case bNorm:
        h = ((rNorm - gNorm) / d + 4) / 6;
        break;
    }
  }

  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);

  return `hsl(${h}, ${s}%, ${l}%)`;
};

interface PokemonMenuProps {
  onPokemonSelect?: (pokemonId: number) => void;
  isShiny: boolean;
  onShinyToggle: (isShiny: boolean) => void;
  onColorsExtracted?: (colors: string[]) => void;
}

export function PokemonMenu({
  onPokemonSelect,
  isShiny,
  onShinyToggle,
  onColorsExtracted,
}: PokemonMenuProps) {
  const pokemonList = getAllPokemonMetadata();
  const [selectedPokemon, setSelectedPokemon] = useState<number | null>(
    pokemonList[0]?.id || null
  );
  const [pokemonData, setPokemonData] = useState<Pokemon | null>(null);
  const [loading, setLoading] = useState(false);
  const [colorFormat, setColorFormat] = useState<"hex" | "hsl" | "rgb">("hex");
  const [isAnimating, setIsAnimating] = useState(false);
  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  const colorTextRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (selectedPokemon) {
      const startTime = Date.now();
      setLoading(true);
      getPokemonById(selectedPokemon)
        .then((data) => {
          setPokemonData(data);
          onPokemonSelect?.(selectedPokemon);
        })
        .finally(() => {
          const elapsed = Date.now() - startTime;
          const minDisplayTime = 1000; // 500ms minimum
          const remaining = minDisplayTime - elapsed;

          if (remaining > 0) {
            setTimeout(() => setLoading(false), remaining);
          } else {
            setLoading(false);
          }
        });
    }
  }, [selectedPokemon, onPokemonSelect]);

  // Extract colors from sprite when pokemonData changes
  useEffect(() => {
    if (pokemonData) {
      const spriteUrl = getSpriteUrl(pokemonData, isShiny);
      if (spriteUrl) {
        extractColorsFromImage(spriteUrl, 6)
          .then((colors) => {
            const top3Colors = colors.slice(0, 3);
            setExtractedColors(top3Colors);
            // Pass all 6 colors to the callback
            onColorsExtracted?.(colors);
            // Also update the pokemonData's colorPalette with extracted colors
            if (pokemonData && top3Colors.length > 0) {
              // Only update if colors actually changed to avoid infinite loop
              const newPalette = {
                ...pokemonData.colorPalette,
                primary: top3Colors[0] || pokemonData.colorPalette.primary,
                secondary: top3Colors[1] || pokemonData.colorPalette.secondary,
                accent: top3Colors[2] || pokemonData.colorPalette.accent,
                highlights: top3Colors,
              };

              // Check if colors are different to avoid infinite update
              if (
                JSON.stringify(newPalette.highlights) !==
                JSON.stringify(pokemonData.colorPalette.highlights)
              ) {
                if (pokemonData) {
                  setPokemonData({
                    ...pokemonData,
                    colorPalette: newPalette,
                  });
                }
              }
            }
          })
          .catch((error) => {
            console.error("Failed to extract colors:", error);
            // Fallback to default colors if extraction fails
            const fallbackColors =
              pokemonData.colorPalette?.highlights?.slice(0, 3) || [];
            setExtractedColors(fallbackColors);
            onColorsExtracted?.(fallbackColors);
          });
      }
    }
  }, [pokemonData?.id, isShiny]); // Only depend on id and isShiny to avoid infinite loop

  const handleSelect = (pokemonId: number) => {
    setSelectedPokemon(pokemonId);
    onPokemonSelect?.(pokemonId);
  };

  const handleRandomize = () => {
    const randomIndex = Math.floor(Math.random() * pokemonList.length);
    const randomPokemon = pokemonList[randomIndex];
    if (randomPokemon) {
      handleSelect(randomPokemon.id);
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseInt(e.target.value);
    if (!isNaN(num) && num >= 1 && num <= pokemonList.length) {
      handleSelect(num);
    }
  };

  const handleIncrement = () => {
    if (selectedPokemon && selectedPokemon < pokemonList.length) {
      handleSelect(selectedPokemon + 1);
    }
  };

  const handleDecrement = () => {
    if (selectedPokemon && selectedPokemon > 1) {
      handleSelect(selectedPokemon - 1);
    }
  };

  // Helper function to get sprite URL
  const getSpriteUrl = (pokemon: Pokemon, shiny: boolean): string | null => {
    if (typeof pokemon.artwork === "object" && "front" in pokemon.artwork) {
      // Use the 2D sprite (front) for color extraction
      if (shiny && pokemon.artwork.shiny) {
        return pokemon.artwork.shiny;
      }
      return pokemon.artwork.front || null;
    }
    return null;
  };

  return (
    <div className="h-full p-8 flex flex-col items-center justify-start gap-6 relative w-full">
      <LoaderOverlay loading={loading} text="Loading Pokemon..." />

      {/* Sprite image */}
      {pokemonData && (
        <div className="flex flex-col items-center gap-2 mt-8">
          <div className="relative">
            {getSpriteUrl(pokemonData, isShiny) ? (
              <Image
                src={getSpriteUrl(pokemonData, isShiny)!}
                alt={pokemonData.name}
                width={400}
                height={400}
                className="w-auto h-auto"
                style={{ imageRendering: "pixelated" }}
                unoptimized
              />
            ) : null}
            {/* Shiny toggle button */}
            <button
              onClick={() => onShinyToggle(!isShiny)}
              className={`absolute -top-2 -right-2 p-2 rounded-full transition-colors cursor-pointer z-10 ${
                isShiny ? "opacity-100" : "opacity-60"
              }`}
              title="Toggle Shiny"
              style={{
                color: extractedColors[0] || pokemonData.colorPalette?.primary,
                backgroundColor: isShiny
                  ? (extractedColors[0] ||
                      pokemonData.colorPalette?.primary ||
                      "#000") + "80"
                  : (extractedColors[0] ||
                      pokemonData.colorPalette?.primary ||
                      "#000") + "20",
              }}
            >
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
          {pokemonData.name && (
            <>
              <h2 className="font-heading text-xl font-semibold text-center">
                {pokemonData.name}
              </h2>
              <p className="text-sm text-muted-foreground text-center">
                {pokemonData.species.toLowerCase().startsWith("the")
                  ? pokemonData.species
                  : `The ${pokemonData.species}`}
              </p>
            </>
          )}
        </div>
      )}

      {/* National Dex Number Input */}
      <div className="w-full flex gap-2">
        <Button
          onClick={handleDecrement}
          variant="outline"
          className="w-8 px-0 cursor-pointer"
          disabled={!selectedPokemon || selectedPokemon <= 1}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Input
          type="number"
          value={selectedPokemon || ""}
          onChange={handleNumberChange}
          placeholder="#"
          className="text-center"
          min={1}
          max={pokemonList.length}
        />
        <Button
          onClick={handleIncrement}
          variant="outline"
          className="w-8 px-0 cursor-pointer"
          disabled={!selectedPokemon || selectedPokemon >= pokemonList.length}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
      </div>

      {/* Search component */}
      <PokemonSearch
        pokemonList={pokemonList}
        selectedPokemon={selectedPokemon}
        onPokemonSelect={handleSelect}
      />

      {/* Randomize button */}
      <Button
        onClick={handleRandomize}
        variant="outline"
        className="w-full cursor-pointer"
      >
        <Shuffle className="w-4 h-4 mr-2" />
        Randomize
      </Button>

      {/* Palette and Forms Tabs */}
      {pokemonData && (
        <Tabs defaultValue="palette" className="w-full mt-4">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="palette" className="cursor-pointer">
              Palette
            </TabsTrigger>
            <TabsTrigger value="forms" className="cursor-pointer">
              Forms/Related
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="palette"
            className="mt-4 space-y-3 max-h-[400px] overflow-y-auto px-2"
          >
            {/* Format selector */}
            <div className="flex justify-end mb-2">
              <Select
                value={colorFormat}
                onValueChange={(value: "hex" | "hsl" | "rgb") => {
                  setIsAnimating(true);
                  setTimeout(() => {
                    setColorFormat(value);
                    setTimeout(() => {
                      setIsAnimating(false);
                    }, 10);
                  }, 150);
                }}
              >
                <SelectTrigger className="w-20 shadow-none cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hex">HEX</SelectItem>
                  <SelectItem value="rgb">RGB</SelectItem>
                  <SelectItem value="hsl">HSL</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(extractedColors.length > 0
              ? extractedColors
              : pokemonData.colorPalette?.highlights?.slice(0, 3) || []
            ).map((color, index) => (
              <div
                key={index}
                className="w-full h-16 rounded-md p-3 flex items-center justify-between border gap-2"
                style={{ backgroundColor: color }}
              >
                <span
                  ref={(el) => {
                    if (el) colorTextRefs.current[index] = el;
                  }}
                  className={`text-xs font-mono ${getTextColor(
                    color
                  )} transition-all duration-300 ${
                    isAnimating
                      ? "scale-105 opacity-0"
                      : "scale-100 opacity-100"
                  }`}
                >
                  {convertColor(color, colorFormat)}
                </span>
                <button className="p-1 hover:bg-black/10 dark:hover:bg-white/20 rounded transition-colors">
                  <svg
                    className={`w-4 h-4 ${getTextColor(color)}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="forms" className="mt-4 space-y-4">
            {/* Evolution Chain */}
            {pokemonData.evolution &&
              Array.isArray(pokemonData.evolution) &&
              pokemonData.evolution.length > 0 && (
                <div className="max-h-[450px] overflow-y-auto px-2">
                  <Separator className="mb-3" />
                  <h3 className="text-sm font-semibold mb-3">
                    Evolution Chain
                  </h3>
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
                              const evoMetadata = getPokemonMetadataByName(
                                evo.name
                              );
                              const evoSprite = evoMetadata?.id
                                ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${
                                    isShiny ? "shiny/" : ""
                                  }${evoMetadata.id}.png`
                                : null;
                              const isSelected =
                                evoMetadata?.id === selectedPokemon;

                              return (
                                <div
                                  key={`${level}-${evoIndex}`}
                                  className="flex flex-col items-center"
                                >
                                  {/* Evolution Pokemon */}
                                  <button
                                    onClick={() => {
                                      if (evoMetadata) {
                                        handleSelect(evoMetadata.id);
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
                                                pokemonData.colorPalette
                                                  ?.primary ||
                                                "#000") + "80",
                                            backgroundColor:
                                              (extractedColors[0] ||
                                                pokemonData.colorPalette
                                                  ?.primary ||
                                                "#000") + "15",
                                          }
                                        : {}
                                    }
                                  >
                                    {evoSprite ? (
                                      <Image
                                        src={evoSprite}
                                        alt={evo.name}
                                        width={isBranch ? 48 : 64}
                                        height={isBranch ? 48 : 64}
                                        className={`${
                                          isBranch ? "w-12 h-12" : "w-16 h-16"
                                        } object-contain`}
                                        style={{
                                          imageRendering: "pixelated",
                                        }}
                                        unoptimized
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
                  </div>
                </div>
              )}

            {/* Forms/Varieties */}
            {pokemonData.varieties && pokemonData.varieties.length > 1 && (
              <div className="max-h-[450px] overflow-y-auto px-2">
                <Separator className="mb-3" />
                <h3 className="text-sm font-semibold mb-2">Forms/Varieties</h3>
                <div className="flex flex-col gap-2">
                  {pokemonData.varieties.map((variety, index) => {
                    const isSelected =
                      getPokemonMetadataByName(variety.name)?.id ===
                      selectedPokemon;
                    const varietySprite = variety.url
                      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${
                          isShiny ? "shiny/" : ""
                        }${variety.url.split("/").slice(-2, -1)[0]}.png`
                      : null;

                    return (
                      <button
                        key={index}
                        onClick={() => {
                          const varietyMetadata = getPokemonMetadataByName(
                            variety.name
                          );
                          if (varietyMetadata) {
                            handleSelect(varietyMetadata.id);
                          }
                        }}
                        className={`flex items-center gap-3 p-3 rounded border transition-all cursor-pointer hover:opacity-80 ${
                          isSelected ? "ring-2" : ""
                        }`}
                        style={
                          isSelected
                            ? {
                                borderColor:
                                  (extractedColors[0] ||
                                    pokemonData.colorPalette?.primary ||
                                    "#000") + "40",
                                backgroundColor:
                                  (extractedColors[0] ||
                                    pokemonData.colorPalette?.primary ||
                                    "#000") + "10",
                              }
                            : {}
                        }
                      >
                        {varietySprite ? (
                          <Image
                            src={varietySprite}
                            alt={variety.name}
                            width={40}
                            height={40}
                            className="w-auto h-auto"
                            style={{ imageRendering: "pixelated" }}
                            unoptimized
                          />
                        ) : (
                          <div className="w-10 h-10 bg-muted rounded flex items-center justify-center text-xs">
                            {variety.name.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 text-left">
                          <div className="text-sm font-medium">
                            {variety.name}
                          </div>
                          {variety.is_default && (
                            <div className="text-xs text-muted-foreground">
                              Default Form
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
