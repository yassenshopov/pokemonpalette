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
import { ColorPickerDialog } from "@/components/color-picker-dialog";
import {
  Shuffle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  GripVertical,
  Edit3,
  Lock,
  Unlock,
} from "lucide-react";

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

// Helper function to validate and normalize color input
const validateAndNormalizeColor = (
  input: string,
  format: "hex" | "hsl" | "rgb"
): string | null => {
  const trimmed = input.trim();

  if (format === "hex") {
    // Handle hex colors
    const hexMatch = trimmed.match(/^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/);
    if (hexMatch) {
      let hex = hexMatch[1];
      if (hex.length === 3) {
        // Convert 3-digit hex to 6-digit
        hex = hex
          .split("")
          .map((char) => char + char)
          .join("");
      }
      return `#${hex.toUpperCase()}`;
    }
  } else if (format === "rgb") {
    // Handle RGB colors
    const rgbMatch = trimmed.match(
      /^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i
    );
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch;
      const rNum = parseInt(r);
      const gNum = parseInt(g);
      const bNum = parseInt(b);

      if (
        rNum >= 0 &&
        rNum <= 255 &&
        gNum >= 0 &&
        gNum <= 255 &&
        bNum >= 0 &&
        bNum <= 255
      ) {
        // Convert to hex for internal storage
        const toHex = (n: number) =>
          n.toString(16).padStart(2, "0").toUpperCase();
        return `#${toHex(rNum)}${toHex(gNum)}${toHex(bNum)}`;
      }
    }
  } else if (format === "hsl") {
    // Handle HSL colors
    const hslMatch = trimmed.match(
      /^hsl\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)$/i
    );
    if (hslMatch) {
      const [, h, s, l] = hslMatch;
      const hNum = parseInt(h);
      const sNum = parseInt(s);
      const lNum = parseInt(l);

      if (
        hNum >= 0 &&
        hNum <= 360 &&
        sNum >= 0 &&
        sNum <= 100 &&
        lNum >= 0 &&
        lNum <= 100
      ) {
        // Convert HSL to hex for internal storage
        const hNorm = hNum / 360;
        const sNorm = sNum / 100;
        const lNorm = lNum / 100;

        const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
        const x = c * (1 - Math.abs(((hNorm * 6) % 2) - 1));
        const m = lNorm - c / 2;

        let r = 0,
          g = 0,
          b = 0;

        if (hNorm * 6 < 1) {
          r = c;
          g = x;
          b = 0;
        } else if (hNorm * 6 < 2) {
          r = x;
          g = c;
          b = 0;
        } else if (hNorm * 6 < 3) {
          r = 0;
          g = c;
          b = x;
        } else if (hNorm * 6 < 4) {
          r = 0;
          g = x;
          b = c;
        } else if (hNorm * 6 < 5) {
          r = x;
          g = 0;
          b = c;
        } else {
          r = c;
          g = 0;
          b = x;
        }

        const rFinal = Math.round((r + m) * 255);
        const gFinal = Math.round((g + m) * 255);
        const bFinal = Math.round((b + m) * 255);

        const toHex = (n: number) =>
          n.toString(16).padStart(2, "0").toUpperCase();
        return `#${toHex(rFinal)}${toHex(gFinal)}${toHex(bFinal)}`;
      }
    }
  }

  return null;
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
  const [lockedColors, setLockedColors] = useState<boolean[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingColor, setEditingColor] = useState<string>("");
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [colorPickerIndex, setColorPickerIndex] = useState<number | null>(null);
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

            // Preserve locked colors and only update unlocked ones
            setExtractedColors((prevColors) => {
              const newColors = [...prevColors];
              top3Colors.forEach((color, index) => {
                if (index < lockedColors.length && !lockedColors[index]) {
                  newColors[index] = color;
                } else if (index >= lockedColors.length) {
                  newColors[index] = color;
                }
              });

              // If we have fewer new colors than existing, keep the existing ones
              const finalColors = newColors.length > 0 ? newColors : top3Colors;
              onColorsExtracted?.(finalColors);
              return finalColors;
            });

            // Initialize lock states if not already set
            setLockedColors((prevLocked) => {
              if (prevLocked.length === 0) {
                return new Array(top3Colors.length).fill(false);
              }
              // Extend lock array if we have more colors now
              if (prevLocked.length < top3Colors.length) {
                return [
                  ...prevLocked,
                  ...new Array(top3Colors.length - prevLocked.length).fill(
                    false
                  ),
                ];
              }
              return prevLocked;
            });
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

  // Drag and drop handlers
  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    index: number
  ) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", e.currentTarget.outerHTML);
    (e.currentTarget as HTMLElement).style.opacity = "0.5";
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).style.opacity = "1";
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    index: number
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (
    e: React.DragEvent<HTMLDivElement>,
    dropIndex: number
  ) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }

    const newColors = [...extractedColors];
    const newLocked = [...lockedColors];
    const draggedColor = newColors[draggedIndex];
    const draggedLock = newLocked[draggedIndex];

    // Remove the dragged items
    newColors.splice(draggedIndex, 1);
    newLocked.splice(draggedIndex, 1);

    // Insert at new position
    newColors.splice(dropIndex, 0, draggedColor);
    newLocked.splice(dropIndex, 0, draggedLock);

    setExtractedColors(newColors);
    setLockedColors(newLocked);
    onColorsExtracted?.(newColors);
    setDragOverIndex(null);
  };

  // Color picker handlers
  const handleEditStart = (index: number, color: string) => {
    // Don't allow editing if color is locked
    if (lockedColors[index]) return;

    setColorPickerIndex(index);
    setColorPickerOpen(true);
  };

  const handleColorPickerChange = (newColor: string) => {
    if (colorPickerIndex === null) return;

    const newColors = [...extractedColors];
    newColors[colorPickerIndex] = newColor;
    setExtractedColors(newColors);
    onColorsExtracted?.(newColors);
    setColorPickerIndex(null);
  };

  const handleColorPickerClose = () => {
    setColorPickerOpen(false);
    setColorPickerIndex(null);
  };

  // Lock/unlock handlers
  const handleToggleLock = (index: number) => {
    setLockedColors((prev) => {
      const newLocked = [...prev];
      newLocked[index] = !newLocked[index];
      return newLocked;
    });
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

          <TabsContent value="palette" className="mt-4 space-y-3 px-2">
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
            ).map((color, index) => {
              const isLocked = lockedColors[index] || false;
              return (
                <div
                  key={`${color}-${index}`}
                  draggable={!isLocked}
                  onDragStart={(e) => !isLocked && handleDragStart(e, index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`w-full h-16 rounded-md p-3 flex items-center justify-between border gap-2 transition-all duration-200 ${
                    !isLocked ? "cursor-move" : "cursor-default"
                  } ${draggedIndex === index ? "scale-105 shadow-lg" : ""} ${
                    dragOverIndex === index && draggedIndex !== index
                      ? "scale-95 ring-2 ring-white/50"
                      : ""
                  } ${isLocked ? "ring-2" : ""}`}
                  style={{
                    backgroundColor: color,
                    ...(isLocked && {
                      borderColor: color + "80", // 50% opacity
                      ringColor: color + "60", // 37.5% opacity
                    }),
                  }}
                  title={
                    isLocked ? "Color is locked" : "Drag to reorder colors"
                  }
                >
                  <div className="flex items-center gap-2 flex-1">
                    {!isLocked && (
                      <GripVertical
                        className={`w-4 h-4 ${getTextColor(
                          color
                        )} opacity-60 hover:opacity-100 transition-opacity`}
                      />
                    )}
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
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleLock(index)}
                      className="p-1 hover:bg-black/10 dark:hover:bg-white/20 rounded transition-colors cursor-pointer"
                      title={isLocked ? "Unlock color" : "Lock color"}
                    >
                      {isLocked ? (
                        <Lock className={`w-4 h-4 ${getTextColor(color)}`} />
                      ) : (
                        <Unlock className={`w-4 h-4 ${getTextColor(color)}`} />
                      )}
                    </button>
                    <button
                      onClick={() => handleEditStart(index, color)}
                      className={`p-1 hover:bg-black/10 dark:hover:bg-white/20 rounded transition-colors ${
                        isLocked
                          ? "opacity-50 cursor-not-allowed"
                          : "cursor-pointer"
                      }`}
                      title={
                        isLocked ? "Cannot edit locked color" : "Edit color"
                      }
                      disabled={isLocked}
                    >
                      <Edit3 className={`w-4 h-4 ${getTextColor(color)}`} />
                    </button>
                  </div>
                </div>
              );
            })}
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

      {/* Color Picker Dialog */}
      <ColorPickerDialog
        open={colorPickerOpen}
        onOpenChange={setColorPickerOpen}
        initialColor={
          colorPickerIndex !== null
            ? extractedColors[colorPickerIndex] || "#000000"
            : "#000000"
        }
        onColorChange={handleColorPickerChange}
        title="Edit Color"
      />
    </div>
  );
}
