"use client";

import { useState, useEffect } from "react";
import { Pokemon } from "@/types/pokemon";
import { getPokemonById } from "@/lib/pokemon";
import { extractColorsFromImage } from "@/lib/color-extractor";
import Image from "next/image";
import { LoaderOverlay } from "@/components/loader-overlay";

interface PokemonHeroProps {
  pokemonId?: number | null;
  isShiny?: boolean;
  onImageSrcChange?: (imageSrc: string | null) => void;
  colors?: string[];
}

export function PokemonHero({
  pokemonId,
  isShiny = false,
  onImageSrcChange,
  colors,
}: PokemonHeroProps) {
  const [pokemon, setPokemon] = useState<Pokemon | null>(null);
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [currentImageSrc, setCurrentImageSrc] = useState<string | null>(null);
  const [extractedColors, setExtractedColors] = useState<string[]>([]);

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

  return (
    <div
      className="min-h-[600px] py-24 px-12 flex items-center justify-center relative overflow-hidden animated-gradient"
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

      <div className="flex gap-12 items-center relative z-10">
        {/* Left: Hero text */}
        <div className="max-w-2xl">
          <h1 className="text-5xl font-bold font-heading mb-4">
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
          <p className="text-lg text-muted-foreground">
            This website allows you to enter a Pokemon&apos;s name (or simply
            its number in the Pokedex), and its top 3 colours will be extracted.
          </p>
        </div>

        {/* Right: Pokemon image */}
        <div className="flex-shrink-0 relative w-[450px] h-[450px]">
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
                className={`object-contain transition-opacity duration-500 ${
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
