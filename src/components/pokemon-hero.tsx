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
}

export function PokemonHero({ pokemonId, isShiny = false }: PokemonHeroProps) {
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
      }
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

  // Get colors - use extracted colors if available, fallback to pokemon data
  const colors = pokemon?.colorPalette;
  const primaryColor = extractedColors[0] || colors?.primary || "#94a3b8";
  const secondaryColor = extractedColors[1] || colors?.secondary || "#94a3b8";
  const highlightColors =
    extractedColors.length >= 2
      ? extractedColors
      : colors?.highlights?.slice(0, 2) || [primaryColor, secondaryColor];

  return (
    <div
      className="h-[600px] py-24 px-12 flex items-center justify-center relative overflow-hidden animated-gradient"
      style={{
        background: `radial-gradient(circle at 80% 20%, ${
          highlightColors[0] || primaryColor
        }50 0%, transparent 60%),
                     radial-gradient(circle at 25% 80%, ${
                       highlightColors[1] || secondaryColor
                     }33 0%, transparent 55%)`,
        transition: "background 1s ease-in-out",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes gradient-shift {
          0%, 100% { 
            background-position: 70% 10%, 30% 85%;
            background-size: 160% 160%, 120% 120%;
          }
          50% { 
            background-position: 90% 30%, 15% 75%;
            background-size: 220% 220%, 180% 180%;
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
            Your website - inspired by colours
          </h1>
          <p className="text-lg text-muted-foreground">
            This website allows you to enter a Pokemon&apos;s name (or simply
            its number in the Pokedex), and its top 3 colours will be extracted.
          </p>
        </div>

        {/* Right: Pokemon image */}
        <div className="flex-shrink-0 relative w-[300px] h-[300px]">
          {pokemon &&
          !loading &&
          typeof pokemon.artwork === "object" &&
          "official" in pokemon.artwork &&
          currentImageSrc ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <Image
                src={currentImageSrc}
                alt={pokemon.name}
                width={300}
                height={300}
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
