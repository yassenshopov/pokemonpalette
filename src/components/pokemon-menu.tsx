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
import { EvolutionChain } from "@/components/evolution-chain";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";
import {
  Shuffle,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Edit3,
  Lock,
  Unlock,
  ChevronRight,
  Menu,
  Palette,
  Sparkles,
} from "lucide-react";
import { DEFAULT_POKEMON_ID, POKEMON_CONSTANTS, type PaletteSize } from "@/constants/pokemon";
import { usePaletteSize } from "@/hooks/use-palette-size";
import { getFrontSpriteUrl, getOfficialArtworkUrl } from "@/lib/sprite-utils";

// MissingNo fallback image URL
const MISSINGNO_IMAGE_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/MissingNo.svg/514px-MissingNo.svg.png";

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

// Helper function to get contrast text color value for inline styles
const getContrastTextColor = (hex: string): string => {
  const hexClean = hex.replace("#", "");
  const r = parseInt(hexClean.substring(0, 2), 16);
  const g = parseInt(hexClean.substring(2, 4), 16);
  const b = parseInt(hexClean.substring(4, 6), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return white for dark colors, black for light colors
  return luminance > 0.5 ? "#000000" : "#ffffff";
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
  isCollapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
  selectedPokemonId?: number | null;
  onVarietySelect?: (varietyId: number | null) => void;
  selectedVarietyId?: number | null;
  onFormSelect?: (formName: string | null) => void;
  selectedFormName?: string | null;
}

export function PokemonMenu({
  onPokemonSelect,
  isShiny,
  onShinyToggle,
  onColorsExtracted,
  isCollapsed = false,
  onToggleCollapse,
  selectedPokemonId,
  onVarietySelect,
  selectedVarietyId: selectedVarietyIdProp,
  onFormSelect,
  selectedFormName: selectedFormNameProp,
}: PokemonMenuProps) {
  const pokemonList = getAllPokemonMetadata();
  const [selectedPokemon, setSelectedPokemon] = useState<number | null>(
    selectedPokemonId || DEFAULT_POKEMON_ID
  );
  const [pokemonData, setPokemonData] = useState<Pokemon | null>(null);
  const [loading, setLoading] = useState(false);
  const [colorFormat, setColorFormat] = useState<"hex" | "hsl" | "rgb">("hex");
  const [isAnimating, setIsAnimating] = useState(false);
  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  const [lockedColors, setLockedColors] = useState<boolean[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [colorPickerIndex, setColorPickerIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string>("palette");
  const [spriteImageError, setSpriteImageError] = useState(false);
  const [dexNumberInput, setDexNumberInput] = useState<string>(
    (selectedPokemonId || DEFAULT_POKEMON_ID).toString()
  );
  const [selectedVarietyId, setSelectedVarietyId] = useState<number | null>(
    selectedVarietyIdProp || null
  );
  const [selectedFormIndex, setSelectedFormIndex] = useState<number | null>(
    null
  );
  const [selectedFormName, setSelectedFormName] = useState<string | null>(
    selectedFormNameProp || null
  );
  const [isEvolutionExpanded, setIsEvolutionExpanded] = useState(true);
  const [isFormsExpanded, setIsFormsExpanded] = useState(true);
  const [isVarietiesExpanded, setIsVarietiesExpanded] = useState(true);
  const [paletteSize] = usePaletteSize();
  const colorTextRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isUpdatingFromDebounceRef = useRef<boolean>(false);

  // Helper function to check if form is an object
  const isFormObject = (
    form: string | any
  ): form is { name: string; sprites?: any } => {
    return typeof form === "object" && "name" in form;
  };

  // Sync selectedPokemonId prop with internal state
  useEffect(() => {
    if (
      selectedPokemonId !== undefined &&
      selectedPokemonId !== selectedPokemon &&
      selectedPokemonId !== null
    ) {
      setSelectedPokemon(selectedPokemonId);
      setDexNumberInput(selectedPokemonId.toString());
      // Reset variety and form selection when Pokemon changes
      setSelectedVarietyId(null);
      onVarietySelect?.(null);
      setSelectedFormIndex(null);
      setSelectedFormName(null);
      onFormSelect?.(null);
    }
  }, [selectedPokemonId, selectedPokemon, onVarietySelect, onFormSelect]);

  // Sync selectedVarietyId prop with internal state
  useEffect(() => {
    if (
      selectedVarietyIdProp !== undefined &&
      selectedVarietyIdProp !== selectedVarietyId
    ) {
      setSelectedVarietyId(selectedVarietyIdProp);
    }
  }, [selectedVarietyIdProp, selectedVarietyId]);

  // Sync selectedFormName prop with internal state
  useEffect(() => {
    if (
      selectedFormNameProp !== undefined &&
      selectedFormNameProp !== selectedFormName
    ) {
      setSelectedFormName(selectedFormNameProp);
      // Find the form index based on the form name
      if (pokemonData?.forms && selectedFormNameProp) {
        const formIndex = pokemonData.forms.findIndex((form) => {
          if (isFormObject(form)) {
            return (
              form.form_name === selectedFormNameProp ||
              form.raw_name === selectedFormNameProp
            );
          }
          return false;
        });
        setSelectedFormIndex(formIndex >= 0 ? formIndex : null);
      } else {
        setSelectedFormIndex(null);
      }
    }
  }, [selectedFormNameProp, selectedFormName, pokemonData?.forms]);

  // Sync dexNumberInput with selectedPokemon when it changes externally
  // (but not when it changes from debounced user input)
  useEffect(() => {
    if (selectedPokemon && !isUpdatingFromDebounceRef.current) {
      setDexNumberInput(selectedPokemon.toString());
    }
    // Reset the flag after sync check
    isUpdatingFromDebounceRef.current = false;
  }, [selectedPokemon]);

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

  // Reset sprite image error when pokemon, shiny state, variety, or form changes
  useEffect(() => {
    setSpriteImageError(false);
  }, [pokemonData?.id, isShiny, selectedVarietyId, selectedFormIndex]);

  // Extract colors from sprite when pokemonData, isShiny, selectedVarietyId, or selectedFormIndex changes
  useEffect(() => {
    if (pokemonData) {
      const spriteUrl = getSpriteUrl(pokemonData, isShiny);
      if (spriteUrl) {
        extractColorsFromImage(spriteUrl, POKEMON_CONSTANTS.COLORS_TO_EXTRACT)
          .then((colors) => {
            const colorStrings = colors.map((c) =>
              typeof c === "string" ? c : c.hex
            );
            const fullColors = colorStrings.slice(
              0,
              POKEMON_CONSTANTS.COLORS_TO_EXTRACT
            );
            const displayed = fullColors.slice(0, paletteSize);

            setExtractedColors(fullColors.length > 0 ? fullColors : displayed);
            setLockedColors(new Array(paletteSize).fill(false));
            onColorsExtracted?.(displayed);

            if (pokemonData && displayed.length > 0) {
              const newPalette = {
                ...pokemonData.colorPalette,
                primary: displayed[0] || pokemonData.colorPalette.primary,
                secondary: displayed[1] || pokemonData.colorPalette.secondary,
                accent: displayed[2] || pokemonData.colorPalette.accent,
                highlights: displayed,
              };
              if (
                JSON.stringify(newPalette.highlights) !==
                JSON.stringify(pokemonData.colorPalette.highlights)
              ) {
                setPokemonData({
                  ...pokemonData,
                  colorPalette: newPalette,
                });
              }
            }
          })
          .catch((error) => {
            console.error("Failed to extract colors:", error);
            const fallbackHighlights =
              pokemonData.colorPalette?.highlights?.slice(0, paletteSize) || [];
            setExtractedColors(fallbackHighlights);
            onColorsExtracted?.(fallbackHighlights);
          });
      }
    }
  }, [pokemonData?.id, isShiny, selectedVarietyId, selectedFormIndex, paletteSize]);

  // When user changes palette size (3/4/5), update lock array and notify parent without re-extracting
  useEffect(() => {
    setLockedColors((prev) => {
      if (prev.length === paletteSize) return prev;
      if (prev.length < paletteSize) {
        return [...prev, ...new Array(paletteSize - prev.length).fill(false)];
      }
      return prev.slice(0, paletteSize);
    });
  }, [paletteSize]);

  // Sync displayed colors (slice by paletteSize) to parent and palette when paletteSize or extractedColors change
  useEffect(() => {
    const displayed = extractedColors.slice(0, paletteSize);
    if (displayed.length === 0) return;
    onColorsExtracted?.(displayed);
    if (pokemonData) {
      setPokemonData((p) => {
        if (!p) return p;
        const newPalette = {
          ...p.colorPalette,
          primary: displayed[0] || p.colorPalette.primary,
          secondary: displayed[1] || p.colorPalette.secondary,
          accent: displayed[2] || p.colorPalette.accent,
          highlights: displayed,
        };
        return JSON.stringify(newPalette.highlights) !== JSON.stringify(p.colorPalette.highlights)
          ? { ...p, colorPalette: newPalette }
          : p;
      });
    }
  }, [paletteSize, extractedColors]); // eslint-disable-line react-hooks/exhaustive-deps -- onColorsExtracted, pokemonData omitted to avoid loops

  const handleSelect = (pokemonId: number) => {
    // Clear any pending debounce timer to prevent race conditions
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    // Reset variety and form selection when Pokemon changes
    setSelectedVarietyId(null);
    onVarietySelect?.(null);
    setSelectedFormIndex(null);
    setSelectedFormName(null);
    onFormSelect?.(null);
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
    const value = e.target.value;
    setDexNumberInput(value);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set up debounced selection
    debounceTimerRef.current = setTimeout(() => {
      const num = parseInt(value);
      if (!isNaN(num) && num >= 1 && num <= pokemonList.length) {
        isUpdatingFromDebounceRef.current = true;
        handleSelect(num);
      } else if (value === "") {
        // If input is empty, keep the current selection
        setDexNumberInput(selectedPokemon?.toString() || "");
      }
    }, 500); // 500ms debounce delay
  };

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleIncrement = () => {
    // Clear any pending debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (selectedPokemon && selectedPokemon < pokemonList.length) {
      handleSelect(selectedPokemon + 1);
    }
  };

  const handleDecrement = () => {
    // Clear any pending debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
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
    onColorsExtracted?.(newColors.slice(0, paletteSize));
    setDragOverIndex(null);
  };

  // Color picker handlers
  const handleEditStart = (index: number) => {
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
    onColorsExtracted?.(newColors.slice(0, paletteSize));
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
    // If a form is selected, use that form's sprite
    if (selectedFormIndex !== null && pokemon.forms) {
      const form = pokemon.forms[selectedFormIndex];
      if (isFormObject(form) && form.sprites) {
        if (shiny && form.sprites.front_shiny) {
          return form.sprites.front_shiny;
        }
        if (form.sprites.front_default) {
          return form.sprites.front_default;
        }
      }
    }

    // If a variety is selected, use that variety's sprite
    if (selectedVarietyId) {
      const fallbackUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${
        shiny ? "shiny/" : ""
      }${selectedVarietyId}.png`;
      return getFrontSpriteUrl(selectedVarietyId, shiny, fallbackUrl);
    }

    if (typeof pokemon.artwork === "object" && "front" in pokemon.artwork) {
      // Use the 2D sprite (front) for color extraction
      if (shiny && pokemon.artwork.shiny) {
        return pokemon.artwork.shiny;
      }
      return pokemon.artwork.front || null;
    }
    return null;
  };

  // Collapsed state for desktop
  if (isCollapsed) {
    return (
      <div className="hidden md:flex items-start justify-center p-4">
        <Button
          onClick={() => onToggleCollapse?.(false)}
          className="p-4 rounded-full border-2 transition-all duration-300 hover:scale-105 relative overflow-hidden w-16 h-16 cursor-pointer"
          style={{
            background: `linear-gradient(135deg, ${
              extractedColors[0] ||
              pokemonData?.colorPalette?.primary ||
              "#6366f1"
            }20 0%, ${
              extractedColors[1] ||
              pokemonData?.colorPalette?.secondary ||
              extractedColors[0] ||
              pokemonData?.colorPalette?.primary ||
              "#8b5cf6"
            }10 100%)`,
            borderColor: `${
              extractedColors[0] ||
              pokemonData?.colorPalette?.primary ||
              "#6366f1"
            }40`,
            color:
              extractedColors[0] ||
              pokemonData?.colorPalette?.primary ||
              "#6366f1",
          }}
          title={
            pokemonData
              ? `Click to expand Pokemon menu\nCurrent: ${pokemonData.name}${
                  isShiny ? " (Shiny)" : ""
                }\n#${pokemonData.id.toString().padStart(3, "0")}`
              : "Click to expand Pokemon menu"
          }
        >
          <Palette className="w-6 h-6" />
        </Button>
      </div>
    );
  }

  return (
    <div className="h-auto md:h-full p-4 md:p-8 flex flex-col items-center justify-start gap-4 md:gap-6 relative w-full xl:max-w-2xl xl:mx-auto">
      <LoaderOverlay loading={loading} text="Loading Pokemon..." />

      {/* Collapse button - desktop only */}
      {onToggleCollapse && (
        <Button
          onClick={() => onToggleCollapse(true)}
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 md:flex hidden p-2 rounded-full hover:bg-accent"
          title="Collapse Pokemon Menu"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      )}

      {/* Sprite image */}
      {pokemonData && (
        <div className="flex flex-col items-center gap-2 mt-4 md:mt-8">
          <div className="relative w-[200px] h-[200px] md:w-[200px] md:h-[200px]">
            <Image
              key={`${pokemonData.id}-${isShiny}-${
                selectedVarietyId || "default"
              }-${selectedFormIndex !== null ? selectedFormIndex : "default"}`}
              src={
                spriteImageError || !getSpriteUrl(pokemonData, isShiny)
                  ? MISSINGNO_IMAGE_URL
                  : getSpriteUrl(pokemonData, isShiny)!
              }
              alt={pokemonData.name}
              width={200}
              height={200}
              className="w-full h-full object-contain"
              style={{
                imageRendering:
                  spriteImageError || !getSpriteUrl(pokemonData, isShiny)
                    ? "auto"
                    : "pixelated",
              }}
              unoptimized
              onError={() => setSpriteImageError(true)}
            />
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
          className="w-8 px-0 cursor-pointer font-heading"
          disabled={!selectedPokemon || selectedPokemon <= 1}
          style={{
            backgroundColor:
              extractedColors[1] ||
              pokemonData?.colorPalette?.secondary ||
              undefined,
            borderColor:
              extractedColors[1] ||
              pokemonData?.colorPalette?.secondary ||
              undefined,
            color: getContrastTextColor(
              extractedColors[1] ||
                pokemonData?.colorPalette?.secondary ||
                "#8b5cf6"
            ),
          }}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Input
          type="number"
          value={dexNumberInput}
          onChange={handleNumberChange}
          placeholder="#"
          className="text-center"
          min={1}
          max={pokemonList.length}
        />
        <Button
          onClick={handleIncrement}
          variant="outline"
          className="w-8 px-0 cursor-pointer font-heading"
          disabled={!selectedPokemon || selectedPokemon >= pokemonList.length}
          style={{
            backgroundColor:
              extractedColors[1] ||
              pokemonData?.colorPalette?.secondary ||
              undefined,
            borderColor:
              extractedColors[1] ||
              pokemonData?.colorPalette?.secondary ||
              undefined,
            color: getContrastTextColor(
              extractedColors[1] ||
                pokemonData?.colorPalette?.secondary ||
                "#8b5cf6"
            ),
          }}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
      </div>

      {/* Search component */}
      <div className="w-full">
        <PokemonSearch
          pokemonList={pokemonList}
          selectedPokemon={selectedPokemon}
          onPokemonSelect={handleSelect}
          autoFocus={false}
        />
      </div>

      {/* Randomize button and Shiny toggle */}
      <div className="w-full flex items-center gap-4">
        {/* Randomize button */}
        <Button
          onClick={handleRandomize}
          variant="outline"
          size="sm"
          className="cursor-pointer font-heading"
          style={{
            backgroundColor:
              extractedColors[0] ||
              pokemonData?.colorPalette?.primary ||
              undefined,
            borderColor:
              extractedColors[0] ||
              pokemonData?.colorPalette?.primary ||
              undefined,
            color: getContrastTextColor(
              extractedColors[0] ||
                pokemonData?.colorPalette?.primary ||
                "#6366f1"
            ),
          }}
        >
          <Shuffle className="w-4 h-4 mr-2" />
          Randomize
        </Button>

        {/* Shiny toggle */}
        <SwitchPrimitive.Root
          checked={isShiny}
          onCheckedChange={onShinyToggle}
          className={cn(
            "peer inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
            isShiny
              ? ""
              : "bg-input dark:bg-input/80 focus-visible:border-ring focus-visible:ring-ring/50"
          )}
          style={
            isShiny
              ? {
                  backgroundColor:
                    extractedColors[0] ||
                    pokemonData?.colorPalette?.primary ||
                    "#6366f1",
                }
              : undefined
          }
        >
          <SwitchPrimitive.Thumb
            className={cn(
              "pointer-events-none flex items-center justify-center size-4 rounded-full ring-0 transition-transform",
              isShiny
                ? "translate-x-[calc(100%-2px)] bg-white"
                : "translate-x-0 bg-background dark:bg-foreground"
            )}
          >
            <Sparkles
              className={cn(
                "w-2.5 h-2.5 transition-opacity",
                isShiny ? "opacity-100" : "opacity-0"
              )}
              style={{
                color: isShiny
                  ? extractedColors[0] ||
                    pokemonData?.colorPalette?.primary ||
                    "#6366f1"
                  : undefined,
              }}
            />
          </SwitchPrimitive.Thumb>
        </SwitchPrimitive.Root>
      </div>

      {/* Palette and Forms Tabs */}
      {pokemonData && (
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full mt-2 md:mt-4"
        >
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger
              value="palette"
              className="cursor-pointer text-sm font-heading"
              style={
                activeTab === "palette"
                  ? {
                      backgroundColor:
                        extractedColors[0] ||
                        pokemonData?.colorPalette?.primary ||
                        undefined,
                      color: getContrastTextColor(
                        extractedColors[0] ||
                          pokemonData?.colorPalette?.primary ||
                          "#6366f1"
                      ),
                    }
                  : {}
              }
            >
              Palette
            </TabsTrigger>
            <TabsTrigger
              value="forms"
              className="cursor-pointer text-sm font-heading"
              style={
                activeTab === "forms"
                  ? {
                      backgroundColor:
                        extractedColors[0] ||
                        pokemonData?.colorPalette?.primary ||
                        undefined,
                      color: getContrastTextColor(
                        extractedColors[0] ||
                          pokemonData?.colorPalette?.primary ||
                          "#6366f1"
                      ),
                    }
                  : {}
              }
            >
              Forms/Related
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="palette"
            className="mt-2 md:mt-4 space-y-2 md:space-y-3 px-1 md:px-2"
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

            {(() => {
              const displayed =
                extractedColors.length > 0
                  ? extractedColors.slice(0, paletteSize)
                  : pokemonData.colorPalette?.highlights?.slice(0, paletteSize) ||
                    [];
              return displayed;
            })().map((color, index) => {
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
                  className={`w-full h-12 md:h-16 rounded-md p-2 md:p-3 flex items-center justify-between border gap-1 md:gap-2 transition-all duration-200 ${
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
                      onClick={() => handleEditStart(index)}
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

          <TabsContent
            value="forms"
            className="mt-2 md:mt-4 space-y-2 md:space-y-4"
          >
            {/* Evolution Chain */}
            {pokemonData.evolution &&
              Array.isArray(pokemonData.evolution) &&
              pokemonData.evolution.length > 0 && (
                <div className="px-1 md:px-2">
                  <Separator className="mb-2 md:mb-3" />
                  <button
                    onClick={() => setIsEvolutionExpanded(!isEvolutionExpanded)}
                    className="flex items-center justify-between w-full mb-2 md:mb-3 cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <h3 className="text-sm font-semibold">Evolution Chain</h3>
                    {isEvolutionExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  {isEvolutionExpanded && (
                    <div className="max-h-[300px] md:max-h-[450px] overflow-y-auto">
                      <EvolutionChain
                        pokemonData={pokemonData}
                        selectedPokemon={selectedPokemon}
                        isShiny={isShiny}
                        extractedColors={extractedColors}
                        onPokemonSelect={handleSelect}
                      />
                    </div>
                  )}
                </div>
              )}

            {/* Forms */}
            {pokemonData.forms &&
              pokemonData.forms.length > 0 &&
              (() => {
                // Filter out non-object forms and check if we have more than just the default form
                const validForms = pokemonData.forms.filter((form) =>
                  isFormObject(form)
                );
                const hasMultipleForms = validForms.length > 1;
                const hasNonDefaultForm = validForms.some((form) => {
                  const formData = isFormObject(form) ? form : null;
                  return formData && !formData.is_default;
                });

                // Only show if there are multiple forms OR if there's a non-default form
                if (!hasMultipleForms && !hasNonDefaultForm) {
                  return null;
                }

                return (
                  <div className="px-1 md:px-2">
                    <Separator className="mb-2 md:mb-3" />
                    <button
                      onClick={() => setIsFormsExpanded(!isFormsExpanded)}
                      className="flex items-center justify-between w-full mb-2 cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      <h3 className="text-sm font-semibold">Forms</h3>
                      {isFormsExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    {isFormsExpanded && (
                      <div className="max-h-[300px] md:max-h-[450px] overflow-y-auto">
                        <div className="flex flex-col gap-2">
                          {pokemonData.forms.map((form, index) => {
                        const formData = isFormObject(form) ? form : null;
                        if (!formData) return null;

                        const isSelected = selectedFormIndex === index;
                        const formSprite = formData.sprites
                          ? isShiny && formData.sprites.front_shiny
                            ? formData.sprites.front_shiny
                            : formData.sprites.front_default
                          : null;

                        return (
                          <button
                            key={index}
                            onClick={() => {
                              // If clicking the same form, deselect it
                              if (selectedFormIndex === index) {
                                setSelectedFormIndex(null);
                                setSelectedFormName(null);
                                onFormSelect?.(null);
                                return;
                              }
                              setSelectedFormIndex(index);
                              // Get form name for the URL - prefer form_name, fallback to extracting from raw_name
                              const formName =
                                formData.form_name ||
                                (formData.raw_name?.includes("-")
                                  ? formData.raw_name
                                      .split("-")
                                      .slice(1)
                                      .join("-")
                                  : formData.raw_name);
                              setSelectedFormName(formName || null);
                              onFormSelect?.(formName || null);
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
                            <Image
                              key={`${formData.name}-${isShiny}-${index}`}
                              src={formSprite || MISSINGNO_IMAGE_URL}
                              alt={formData.name}
                              width={40}
                              height={40}
                              className="w-10 h-10 object-contain"
                              style={{
                                imageRendering: formSprite
                                  ? "pixelated"
                                  : "auto",
                              }}
                              unoptimized
                              onError={(e) => {
                                const target = e.currentTarget;
                                if (target.src !== MISSINGNO_IMAGE_URL) {
                                  target.src = MISSINGNO_IMAGE_URL;
                                  target.style.imageRendering = "auto";
                                }
                              }}
                            />
                            <div className="flex-1 text-left">
                              <div className="text-sm font-medium">
                                {formData.name}
                              </div>
                              <div className="flex gap-1 flex-wrap mt-1">
                                {formData.is_default && (
                                  <span className="text-xs text-muted-foreground">
                                    Default
                                  </span>
                                )}
                                {formData.is_mega && (
                                  <span className="text-xs text-muted-foreground">
                                    Mega
                                  </span>
                                )}
                                {formData.is_gigantamax && (
                                  <span className="text-xs text-muted-foreground">
                                    G-Max
                                  </span>
                                )}
                                {formData.is_battle_only && (
                                  <span className="text-xs text-muted-foreground">
                                    Battle Only
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                          );
                        })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

            {/* Varieties */}
            {pokemonData.varieties && pokemonData.varieties.length > 1 && (
              <div className="px-1 md:px-2">
                <Separator className="mb-2 md:mb-3" />
                <button
                  onClick={() => setIsVarietiesExpanded(!isVarietiesExpanded)}
                  className="flex items-center justify-between w-full mb-2 cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <h3 className="text-sm font-semibold">Varieties</h3>
                  {isVarietiesExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
                {isVarietiesExpanded && (
                  <div className="max-h-[300px] md:max-h-[450px] overflow-y-auto">
                    <div className="flex flex-col gap-2">
                      {pokemonData.varieties.map((variety, index) => {
                    const isSelected =
                      getPokemonMetadataByName(variety.name)?.id ===
                      selectedPokemon;
                    // Extract Pokemon ID from variety URL for sprite
                    const urlMatch = variety.url?.match(/\/(\d+)\/?$/);
                    const varietySpriteId = urlMatch ? parseInt(urlMatch[1]) : null;
                    const fallbackUrl = varietySpriteId
                      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${
                          isShiny ? "shiny/" : ""
                        }${varietySpriteId}.png`
                      : null;
                    const varietySprite = varietySpriteId
                      ? getFrontSpriteUrl(varietySpriteId, isShiny, fallbackUrl)
                      : null;

                    return (
                      <button
                        key={index}
                        onClick={() => {
                          // If clicking the default form, reset variety selection
                          if (variety.is_default) {
                            setSelectedVarietyId(null);
                            onVarietySelect?.(null);
                            return;
                          }

                          // Extract Pokemon ID from variety URL (format: .../pokemon/10157/)
                          const urlMatch = variety.url?.match(/\/(\d+)\/?$/);
                          const varietyId = urlMatch
                            ? parseInt(urlMatch[1])
                            : null;

                          if (varietyId) {
                            setSelectedVarietyId(varietyId);
                            onVarietySelect?.(varietyId);
                          } else {
                            // Fallback: if we can't extract ID, try to get metadata by name
                            const varietyMetadata = getPokemonMetadataByName(
                              variety.name
                            );
                            if (varietyMetadata) {
                              handleSelect(varietyMetadata.id);
                            }
                          }
                        }}
                        className={`flex items-center gap-3 p-3 rounded border transition-all cursor-pointer hover:opacity-80 ${
                          isSelected ||
                          (selectedVarietyId &&
                            variety.url &&
                            (() => {
                              const match = variety.url.match(/\/(\d+)\/?$/);
                              return match
                                ? parseInt(match[1]) === selectedVarietyId
                                : false;
                            })())
                            ? "ring-2"
                            : ""
                        }`}
                        style={
                          isSelected ||
                          (selectedVarietyId &&
                            variety.url &&
                            (() => {
                              const match = variety.url.match(/\/(\d+)\/?$/);
                              return match
                                ? parseInt(match[1]) === selectedVarietyId
                                : false;
                            })())
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
                        <VarietySprite
                          src={varietySprite || MISSINGNO_IMAGE_URL}
                          fallbackUrl={fallbackUrl}
                          alt={variety.name}
                          width={40}
                          height={40}
                        />
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

// Component to handle variety sprite with fallback
function VarietySprite({
  src,
  fallbackUrl,
  alt,
  width,
  height,
}: {
  src: string;
  fallbackUrl: string | null;
  alt: string;
  width: number;
  height: number;
}) {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  // Update imgSrc when src prop changes (e.g., when isShiny toggles)
  useEffect(() => {
    setImgSrc(src);
    setHasError(false);
  }, [src]);

  const handleError = () => {
    if (!hasError && fallbackUrl && imgSrc !== fallbackUrl && imgSrc.startsWith('/pokemon/')) {
      setHasError(true);
      setImgSrc(fallbackUrl);
    } else if (!hasError && imgSrc !== MISSINGNO_IMAGE_URL) {
      setHasError(true);
      setImgSrc(MISSINGNO_IMAGE_URL);
    }
  };

  return (
    <Image
      key={imgSrc}
      src={imgSrc}
      alt={alt}
      width={width}
      height={height}
      className="w-10 h-10 object-contain"
      style={{
        imageRendering: imgSrc !== MISSINGNO_IMAGE_URL ? "pixelated" : "auto",
      }}
      unoptimized
      onError={handleError}
    />
  );
}
