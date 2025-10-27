"use client";

import { useState, useEffect } from "react";
import { Pokemon } from "@/types/pokemon";
import { getPokemonById } from "@/lib/pokemon";
import Image from "next/image";
import { LoaderOverlay } from "@/components/loader-overlay";

interface PokemonHeroProps {
  pokemonId?: number | null;
  isShiny?: boolean;
}

export function PokemonHero({ pokemonId, isShiny = false }: PokemonHeroProps) {
  const [pokemon, setPokemon] = useState<Pokemon | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (pokemonId) {
      const startTime = Date.now();
      setLoading(true);
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
    }
  }, [pokemonId]);

  // Get colors from pokemon data
  const colors = pokemon?.colorPalette;
  const primaryColor = colors?.primary || "#94a3b8";
  const secondaryColor = colors?.secondary || "#94a3b8";
  const highlightColors = colors?.highlights?.slice(0, 2) || [
    primaryColor,
    secondaryColor,
  ];

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
            This website allows you to enter a Pokemon's name (or simply its
            number in the Pokedex), and its top 3 colours will be extracted.
          </p>
        </div>

        {/* Right: Pokemon image */}
        {pokemon && !loading ? (
          <div className="flex-shrink-0">
            {typeof pokemon.artwork === "object" &&
            "official" in pokemon.artwork ? (
              <Image
                src={
                  isShiny
                    ? pokemon.artwork.official.replace(
                        "/other/official-artwork/",
                        "/other/official-artwork/shiny/"
                      )
                    : pokemon.artwork.official
                }
                alt={pokemon.name}
                width={150}
                height={150}
                className="w-auto h-auto"
                unoptimized
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {!pokemon && !loading && (
        <div className="text-muted-foreground/60 text-center relative z-10">
          Select a Pokémon to get started
        </div>
      )}
    </div>
  );
}
