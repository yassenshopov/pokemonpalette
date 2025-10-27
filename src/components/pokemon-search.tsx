"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { PokemonMetadata } from "@/types/pokemon";
import Image from "next/image";
import { Pokemon } from "@/types/pokemon";
import { getPokemonById } from "@/lib/pokemon";

interface PokemonSearchProps {
  pokemonList: PokemonMetadata[];
  selectedPokemon: number | null;
  onPokemonSelect: (pokemonId: number) => void;
}

export function PokemonSearch({
  pokemonList,
  selectedPokemon,
  onPokemonSelect,
}: PokemonSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PokemonMetadata[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Load full Pokemon data for sprites
  const [pokemonSprites, setPokemonSprites] = useState<
    Record<number, string | null>
  >({});

  useEffect(() => {
    const loadSprite = async (id: number) => {
      if (!pokemonSprites[id]) {
        try {
          const pokemon = await getPokemonById(id);
          if (
            pokemon &&
            typeof pokemon.artwork === "object" &&
            "front" in pokemon.artwork
          ) {
            setPokemonSprites((prev) => ({
              ...prev,
              [id]: pokemon.artwork.front,
            }));
          }
        } catch (error) {
          console.error(`Failed to load sprite for Pokemon ${id}:`, error);
        }
      }
    };

    // Load sprites for visible suggestions
    suggestions.forEach((pokemon) => {
      loadSprite(pokemon.id);
    });
  }, [suggestions, pokemonSprites]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setSuggestions([]);
      return;
    }

    const filtered = pokemonList.filter(
      (pokemon) =>
        pokemon.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pokemon.id.toString().includes(searchQuery)
    );

    setSuggestions(filtered);
  }, [searchQuery, pokemonList]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (pokemonId: number) => {
    onPokemonSelect(pokemonId);
    setSearchQuery("");
    setShowSuggestions(false);
    setSelectedIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (suggestions[selectedIndex]) {
          handleSelect(suggestions[selectedIndex].id);
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        setSelectedIndex(0);
        break;
    }
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Sync search query with selected Pokemon
  useEffect(() => {
    if (selectedPokemon) {
      const selected = pokemonList.find((p) => p.id === selectedPokemon);
      if (selected) {
        setSearchQuery(selected.name);
      }
    }
  }, [selectedPokemon, pokemonList]);

  // Auto-scroll to selected item
  useEffect(() => {
    const selectedItem = itemRefs.current[selectedIndex];
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  return (
    <div className="w-full relative" ref={searchRef}>
      <Input
        type="text"
        placeholder="Search Pokemon..."
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setShowSuggestions(true);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => setShowSuggestions(true)}
        className="w-full"
      />

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover border rounded-md max-h-[400px] overflow-y-auto z-50">
          {suggestions.map((pokemon, index) => (
            <button
              key={pokemon.id}
              ref={(el) => (itemRefs.current[index] = el)}
              onClick={() => handleSelect(pokemon.id)}
              className={`w-full flex items-center gap-3 p-3 transition-colors text-left cursor-pointer ${
                index === selectedIndex ? "bg-accent" : "hover:bg-accent"
              }`}
            >
              {/* Sprite */}
              {pokemonSprites[pokemon.id] ? (
                <Image
                  src={pokemonSprites[pokemon.id]!}
                  alt={pokemon.name}
                  width={32}
                  height={32}
                  className="w-8 h-8 object-contain"
                  unoptimized
                />
              ) : (
                <div className="w-8 h-8 bg-muted animate-pulse rounded" />
              )}

              {/* Number and Name */}
              <div className="flex-1 flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-8">
                  #{pokemon.id}
                </span>
                <span className="font-medium">{pokemon.name}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
