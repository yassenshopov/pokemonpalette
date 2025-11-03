"use client";

import { useState, useEffect } from "react";
import { Pokemon } from "@/types/pokemon";
import { getPokemonById } from "@/lib/pokemon";
import { extractColorsFromImage } from "@/lib/color-extractor";
import Image from "next/image";
import { LoaderOverlay } from "@/components/loader-overlay";
import { Button } from "@/components/ui/button";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { Save, Heart } from "lucide-react";
import { SavedPalettesDialog } from "@/components/saved-palettes-dialog";

interface PokemonHeroProps {
  pokemonId?: number | null;
  isShiny?: boolean;
  onImageSrcChange?: (imageSrc: string | null) => void;
  colors?: string[];
  onPaletteLoad?: (palette: {
    pokemonId: number;
    isShiny: boolean;
    colors: string[];
  }) => void;
}

export function PokemonHero({
  pokemonId,
  isShiny = false,
  onImageSrcChange,
  colors,
  onPaletteLoad,
}: PokemonHeroProps) {
  const [pokemon, setPokemon] = useState<Pokemon | null>(null);
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [currentImageSrc, setCurrentImageSrc] = useState<string | null>(null);
  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  const [savingPalette, setSavingPalette] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [existingPaletteId, setExistingPaletteId] = useState<string | null>(null);
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (pokemonId) {
      const startTime = Date.now();
      setLoading(true);
      setImageLoading(true);
      getPokemonById(pokemonId)
        .then((data) => {
          setPokemon(data);
        })
        .finally(() => {
          const elapsed = Date.now() - startTime;
          const minDisplayTime = 500; // 500ms minimum
          const remaining = minDisplayTime - elapsed;

          if (remaining > 0) {
            setTimeout(() => setLoading(false), remaining);
          } else {
            setLoading(false);
          }
        });
    } else {
      setPokemon(null);
      setCurrentImageSrc(null);
    }
  }, [pokemonId]);

  // Update image src when pokemon or shiny state changes
  useEffect(() => {
    if (
      pokemon &&
      typeof pokemon.artwork === "object" &&
      "official" in pokemon.artwork
    ) {
      const newSrc = isShiny
        ? pokemon.artwork.official.replace(
            "/other/official-artwork/",
            "/other/official-artwork/shiny/"
          )
        : pokemon.artwork.official;

      if (newSrc !== currentImageSrc) {
        setImageLoading(true);
        setCurrentImageSrc(newSrc);
        onImageSrcChange?.(newSrc);
      }
    } else {
      onImageSrcChange?.(null);
    }
  }, [pokemon, isShiny]);

  // Extract colors from the official artwork when image src changes
  useEffect(() => {
    if (currentImageSrc) {
      // Small delay to ensure image is loaded
      const timer = setTimeout(() => {
        extractColorsFromImage(currentImageSrc, 2)
          .then((colors) => {
            setExtractedColors(colors);
          })
          .catch((error) => {
            console.error("Failed to extract colors:", error);
            // Fallback to default colors
            setExtractedColors([]);
          });
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [currentImageSrc]);

  // Get colors - use passed colors from pokemon menu (source of truth)
  const colorPalette = pokemon?.colorPalette;
  const primaryColor = colors?.[0] || colorPalette?.primary || "#94a3b8";
  const secondaryColor = colors?.[1] || colorPalette?.secondary || "#94a3b8";
  const highlightColors =
    colors && colors.length >= 2
      ? colors.slice(0, 2)
      : colorPalette?.highlights?.slice(0, 2) || [primaryColor, secondaryColor];

  // Check for existing palette
  const checkExistingPalette = async () => {
    if (!user || !pokemon) return;

    setCheckingExisting(true);
    try {
      const response = await fetch("/api/saved-palettes");
      const data = await response.json();

      if (response.ok && data.palettes) {
        const existing = data.palettes.find((p: any) => 
          p.pokemon_id === pokemon.id && 
          p.is_shiny === isShiny &&
          (p.pokemon_form || null) === (pokemon.forms?.[0]?.name || null)
        );
        setExistingPaletteId(existing ? existing.id : null);
      } else if (response.status === 503) {
        // Authentication service unavailable - silently fail
        console.warn("Authentication service unavailable");
        setExistingPaletteId(null);
      } else if (response.status === 401) {
        // User not authenticated - this is expected, silently fail
        setExistingPaletteId(null);
      }
    } catch (error) {
      console.error("Error checking existing palette:", error);
      setExistingPaletteId(null);
    } finally {
      setCheckingExisting(false);
    }
  };

  // Check for existing palette when pokemon or shiny state changes
  useEffect(() => {
    if (user && pokemon && colors && colors.length > 0) {
      checkExistingPalette();
    } else {
      setExistingPaletteId(null);
    }
  }, [user, pokemon, isShiny, colors]);

  // Save palette function
  const handleSavePalette = async () => {
    if (!user || !pokemon || !colors || colors.length === 0) {
      if (!user) {
        toast.error("Please sign in to save palettes");
      } else {
        toast.error("No palette to save");
      }
      return;
    }

    setSavingPalette(true);

    try {
      const paletteData = {
        pokemonId: pokemon.id,
        pokemonName: pokemon.name,
        pokemonForm: pokemon.forms?.[0]?.name || undefined,
        isShiny,
        colors,
        imageUrl: currentImageSrc || undefined,
        paletteName: `${pokemon.name}${isShiny ? " (Shiny)" : ""} Palette`,
      };

      const response = await fetch("/api/saved-palettes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paletteData),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(result.message || "Palette saved successfully!");
        // Refresh existing palette check
        checkExistingPalette();
      } else if (response.status === 503) {
        toast.error("Authentication service is currently unavailable. Please try again later.");
      } else if (response.status === 401) {
        toast.error("Please sign in to save palettes");
      } else {
        toast.error(result.error || "Failed to save palette");
      }
    } catch (error) {
      console.error("Error saving palette:", error);
      toast.error("Failed to save palette");
    } finally {
      setSavingPalette(false);
    }
  };

  // Unsave palette function
  const handleUnsavePalette = async () => {
    if (!existingPaletteId) return;

    setSavingPalette(true);

    try {
      const response = await fetch(`/api/saved-palettes/${existingPaletteId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Palette removed successfully!");
        setExistingPaletteId(null);
      } else if (response.status === 503) {
        toast.error("Authentication service is currently unavailable. Please try again later.");
      } else if (response.status === 401) {
        toast.error("Please sign in to manage palettes");
      } else {
        toast.error(result.error || "Failed to remove palette");
      }
    } catch (error) {
      console.error("Error removing palette:", error);
      toast.error("Failed to remove palette");
    } finally {
      setSavingPalette(false);
    }
  };

  return (
    <div
      className="min-h-[400px] md:min-h-[600px] py-12 md:py-24 px-4 md:px-12 flex items-center justify-center relative overflow-hidden animated-gradient"
      style={{
        background: `radial-gradient(circle at top right, ${
          highlightColors[0] || primaryColor
        }70 0%, transparent 60%)`,
        transition: "background 1s ease-in-out",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes gradient-shift {
          0%, 100% { 
            background-size: 120% 120%;
          }
          50% { 
            background-size: 200% 200%;
          }
        }
        .animated-gradient {
          animation: gradient-shift 15s ease infinite;
        }
      `,
        }}
      />

      <LoaderOverlay loading={loading} text="Loading..." />

      <div className="flex flex-col md:flex-row gap-6 md:gap-12 items-center relative z-10 text-center md:text-left">
        {/* Left: Hero text */}
        <div className="max-w-2xl">
          <h1 className="text-3xl md:text-5xl font-bold font-heading mb-4">
            {pokemon ? (
              <>
                Your website - inspired by{" "}
                <span
                  className="capitalize bg-clip-text text-transparent block mt-1"
                  style={{
                    backgroundImage: `linear-gradient(to right, ${primaryColor}, #202020)`,
                  }}
                >
                  {pokemon.name}
                </span>
              </>
            ) : (
              "Your website - inspired by colours"
            )}
          </h1>
          <p className="text-base md:text-lg text-muted-foreground mb-6">
            This website allows you to enter a Pokemon&apos;s name (or simply
            its number in the Pokedex), and its top 3 colours will be extracted.
          </p>
          
          {/* Save/Unsave Palette Button */}
          {pokemon && colors && colors.length > 0 && (
            <Button
              onClick={existingPaletteId ? handleUnsavePalette : handleSavePalette}
              disabled={savingPalette || checkingExisting || !isLoaded}
              className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
              style={{
                backgroundColor: existingPaletteId ? "#ef4444" : primaryColor,
                color: "white",
              }}
            >
              {savingPalette ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {existingPaletteId ? "Removing..." : "Saving..."}
                </>
              ) : checkingExisting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <Heart className={`w-4 h-4 ${existingPaletteId ? "fill-current" : ""}`} />
                  {existingPaletteId ? "Remove from Saved" : "Save Palette"}
                </>
              )}
            </Button>
          )}
        </div>

        {/* Right: Pokemon image */}
        <div className="flex-shrink-0 relative w-[250px] h-[250px] md:w-[450px] md:h-[450px]">
          {pokemon &&
          !loading &&
          typeof pokemon.artwork === "object" &&
          "official" in pokemon.artwork &&
          currentImageSrc ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <Image
                src={currentImageSrc}
                alt={pokemon.name}
                width={450}
                height={450}
                className={`w-full h-full object-contain transition-opacity duration-500 ${
                  imageLoading ? "opacity-0" : "opacity-100"
                }`}
                onLoad={() => setImageLoading(false)}
                unoptimized
              />
            </div>
          ) : null}
        </div>
      </div>

      {!pokemon && !loading && (
        <div className="text-muted-foreground/60 text-center relative z-10">
          Select a Pokémon to get started
        </div>
      )}
    </div>
  );
}
