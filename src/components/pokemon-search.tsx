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
  isShiny?: boolean;
  guessedPokemonIds?: number[];
  selectedGenerations?: number[];
  autoFocus?: boolean;
  placeholder?: string;
}

// Get generation from Pokemon ID
const getGenerationFromId = (id: number): number => {
  if (id <= 151) return 1;
  if (id <= 251) return 2;
  if (id <= 386) return 3;
  if (id <= 493) return 4;
  if (id <= 649) return 5;
  if (id <= 721) return 6;
  if (id <= 809) return 7;
  if (id <= 905) return 8;
  if (id <= 1025) return 9;
  return 1; // Default fallback
};

export function PokemonSearch({
  pokemonList,
  selectedPokemon,
  onPokemonSelect,
  isShiny = false,
  guessedPokemonIds = [],
  selectedGenerations,
  autoFocus = true,
  placeholder = "Search Pokemon...",
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
  const loadingSpritesRef = useRef<Set<number>>(new Set());
  const loadedSpritesRef = useRef<Set<number>>(new Set());

  // Cache for Pokemon language names (to avoid reloading for search)
  const [pokemonLanguageNames, setPokemonLanguageNames] = useState<
    Record<number, Record<string, string>>
  >({});

  // Clear sprite cache when isShiny changes
  useEffect(() => {
    setPokemonSprites({});
    loadingSpritesRef.current.clear();
    loadedSpritesRef.current.clear();
  }, [isShiny]);

  useEffect(() => {
    const loadSprite = async (id: number) => {
      // Skip if already loaded or currently loading
      if (
        loadedSpritesRef.current.has(id) ||
        loadingSpritesRef.current.has(id)
      ) {
        return;
      }

      loadingSpritesRef.current.add(id);
      try {
        const pokemon = await getPokemonById(id);
        if (
          pokemon &&
          typeof pokemon.artwork === "object" &&
          "front" in pokemon.artwork
        ) {
          // Use shiny sprite if isShiny is true and shiny artwork is available
          let spriteUrl: string | null = null;
          if (isShiny && "shiny" in pokemon.artwork && pokemon.artwork.shiny) {
            spriteUrl = pokemon.artwork.shiny;
          } else {
            spriteUrl = pokemon.artwork.front || null;
          }

          setPokemonSprites((prev) => {
            // Double-check we haven't loaded it in the meantime
            if (prev[id]) return prev;
            loadedSpritesRef.current.add(id);
            return {
              ...prev,
              [id]: spriteUrl,
            };
          });
        }
      } catch (error) {
        console.error(`Failed to load sprite for Pokemon ${id}:`, error);
      } finally {
        loadingSpritesRef.current.delete(id);
      }
    };

    // Load sprites for visible suggestions
    suggestions.forEach((pokemon) => {
      loadSprite(pokemon.id);
    });
  }, [suggestions, isShiny]);

  // Load language names for Pokemon (for multi-language search)
  useEffect(() => {
    const loadLanguageNames = async (id: number) => {
      try {
        const pokemon = await getPokemonById(id);
        if (pokemon?.names) {
          setPokemonLanguageNames((prev) => {
            // Only update if not already cached
            if (prev[id]) return prev;
            return {
              ...prev,
              [id]: pokemon.names!,
            };
          });
        }
      } catch (error) {
        // Silently fail - language names are optional
      }
    };

    // Load language names for Pokemon that don't match English name/ID
    // This allows searching by other languages
    if (searchQuery.trim()) {
      const queryLower = searchQuery.toLowerCase();
      pokemonList.forEach((pokemon) => {
        // Only load if:
        // 1. Not already cached
        // 2. Doesn't match English name or ID (so we need to check languages)
        const matchesEnglish =
          pokemon.name.toLowerCase().includes(queryLower) ||
          pokemon.id.toString().includes(queryLower);

        if (!pokemonLanguageNames[pokemon.id] && !matchesEnglish) {
          loadLanguageNames(pokemon.id);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, pokemonList]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setSuggestions([]);
      return;
    }

    const queryLower = searchQuery.toLowerCase();

    const filtered = pokemonList.filter((pokemon) => {
      // Check English name
      if (pokemon.name.toLowerCase().includes(queryLower)) {
        return true;
      }

      // Check ID
      if (pokemon.id.toString().includes(queryLower)) {
        return true;
      }

      // Check language names if available
      const languageNames = pokemonLanguageNames[pokemon.id];
      if (languageNames) {
        const matchesLanguage = Object.values(languageNames).some((name) =>
          name.toLowerCase().includes(queryLower)
        );
        if (matchesLanguage) {
          return true;
        }
      }

      return false;
    });

    setSuggestions(filtered);
  }, [searchQuery, pokemonList, pokemonLanguageNames]);

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
        setSelectedIndex((prev) => {
          let next = prev < suggestions.length - 1 ? prev + 1 : 0;
          // Skip disabled items
          let attempts = 0;
          while (attempts < suggestions.length) {
            const pokemon = suggestions[next];
            const generation = getGenerationFromId(pokemon.id);
            const isGenerationSelected = selectedGenerations
              ? selectedGenerations.includes(generation)
              : true;
            if (
              !guessedPokemonIds.includes(pokemon.id) &&
              isGenerationSelected
            ) {
              break;
            }
            next = next < suggestions.length - 1 ? next + 1 : 0;
            attempts++;
          }
          return next;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => {
          let next = prev > 0 ? prev - 1 : suggestions.length - 1;
          // Skip disabled items
          let attempts = 0;
          while (attempts < suggestions.length) {
            const pokemon = suggestions[next];
            const generation = getGenerationFromId(pokemon.id);
            const isGenerationSelected = selectedGenerations
              ? selectedGenerations.includes(generation)
              : true;
            if (
              !guessedPokemonIds.includes(pokemon.id) &&
              isGenerationSelected
            ) {
              break;
            }
            next = next > 0 ? next - 1 : suggestions.length - 1;
            attempts++;
          }
          return next;
        });
        break;
      case "Enter":
        e.preventDefault();
        if (suggestions[selectedIndex]) {
          const pokemon = suggestions[selectedIndex];
          const generation = getGenerationFromId(pokemon.id);
          const isGenerationSelected = selectedGenerations
            ? selectedGenerations.includes(generation)
            : true;
          if (!guessedPokemonIds.includes(pokemon.id) && isGenerationSelected) {
            handleSelect(pokemon.id);
          }
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        setSelectedIndex(0);
        break;
    }
  };

  useEffect(() => {
    // Find first non-guessed and generation-selected Pokemon
    const firstAvailable = suggestions.findIndex((p) => {
      const generation = getGenerationFromId(p.id);
      const isGenerationSelected = selectedGenerations
        ? selectedGenerations.includes(generation)
        : true;
      return !guessedPokemonIds.includes(p.id) && isGenerationSelected;
    });
    setSelectedIndex(firstAvailable >= 0 ? firstAvailable : 0);
  }, [searchQuery, suggestions, guessedPokemonIds, selectedGenerations]);

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
        placeholder={placeholder}
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setShowSuggestions(true);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => setShowSuggestions(true)}
        className="w-full"
        autoFocus={autoFocus}
      />

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover border rounded-md max-h-[400px] overflow-y-auto z-50">
          {suggestions.map((pokemon, index) => {
            const isGuessed = guessedPokemonIds.includes(pokemon.id);
            const generation = getGenerationFromId(pokemon.id);
            const isGenerationSelected = selectedGenerations
              ? selectedGenerations.includes(generation)
              : true;
            const isDisabled = isGuessed || !isGenerationSelected;
            return (
              <button
                key={pokemon.id}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                onClick={() => !isDisabled && handleSelect(pokemon.id)}
                disabled={isDisabled}
                className={`w-full flex items-center gap-3 p-3 transition-colors text-left ${
                  isDisabled
                    ? "opacity-40 cursor-not-allowed"
                    : "cursor-pointer hover:bg-accent"
                } ${index === selectedIndex && !isDisabled ? "bg-accent" : ""}`}
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
                  {isGuessed && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      (Already guessed)
                    </span>
                  )}
                  {!isGuessed && !isGenerationSelected && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      (Generation not selected)
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
