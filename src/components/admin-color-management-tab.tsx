"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extractColorsFromImage, ColorWithFrequency } from "@/lib/color-extractor";
import { Loader2 } from "lucide-react";
import Image from "next/image";

interface PokemonColorData {
  id: number;
  name: string;
  spriteUrl: string | null;
  shinySpriteUrl: string | null;
  staticColors: string[];
  staticShinyColors: string[];
}

interface PokemonWithExtractedColors extends PokemonColorData {
  extractedColors: ColorWithFrequency[];
  extracting: boolean;
  extracted: boolean;
}

export function AdminColorManagementTab() {
  const [pokemonList, setPokemonList] = useState<PokemonWithExtractedColors[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [minId, setMinId] = useState<string>("");
  const [maxId, setMaxId] = useState<string>("");
  const [updating, setUpdating] = useState<number | null>(null);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [isShinyMode, setIsShinyMode] = useState(false);

  useEffect(() => {
    const fetchPokemon = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/admin/pokemon-colors");

        if (!response.ok) {
          if (response.status === 403) {
            setError("Access denied. Admin privileges required.");
          } else if (response.status === 401) {
            setError("Unauthorized. Please sign in.");
          } else {
            setError("Failed to fetch Pokemon data");
          }
          return;
        }

        const data = await response.json();
        const pokemonWithExtracted = data.pokemon.map((p: PokemonColorData) => ({
          ...p,
          shinySpriteUrl: p.shinySpriteUrl || null,
          staticShinyColors: p.staticShinyColors || [],
          extractedColors: [],
          extracting: false,
          extracted: false,
        }));
        setPokemonList(pokemonWithExtracted);
      } catch (err) {
        console.error("Error fetching Pokemon:", err);
        setError("Failed to load Pokemon data");
      } finally {
        setLoading(false);
      }
    };

    fetchPokemon();
  }, []);

  const extractColorsForPokemon = async (pokemon: PokemonWithExtractedColors) => {
    const spriteUrl = isShinyMode ? pokemon.shinySpriteUrl : pokemon.spriteUrl;
    if (!spriteUrl || pokemon.extracted) return;

    setPokemonList((prev) =>
      prev.map((p) =>
        p.id === pokemon.id ? { ...p, extracting: true } : p
      )
    );

    try {
      const colors = await extractColorsFromImage(
        spriteUrl,
        3,
        true
      ) as ColorWithFrequency[];

      setPokemonList((prev) =>
        prev.map((p) =>
          p.id === pokemon.id
            ? { ...p, extractedColors: colors, extracting: false, extracted: true }
            : p
        )
      );
    } catch (err) {
      console.error(`Error extracting colors for ${pokemon.name}:`, err);
      setPokemonList((prev) =>
        prev.map((p) =>
          p.id === pokemon.id ? { ...p, extracting: false } : p
        )
      );
    }
  };

  const handleUpdateColors = async (pokemon: PokemonWithExtractedColors) => {
    const spriteUrl = isShinyMode ? pokemon.shinySpriteUrl : pokemon.spriteUrl;
    if (!spriteUrl) return;

    // Extract colors first if not already extracted
    let colorsToUpdate: string[] = [];
    
    if (pokemon.extracted && pokemon.extractedColors.length > 0) {
      // Use already extracted colors
      colorsToUpdate = pokemon.extractedColors.slice(0, 3).map((c) => c.hex);
    } else {
      // Extract colors first
      setUpdating(pokemon.id);
      try {
        const colors = await extractColorsFromImage(
          spriteUrl,
          3,
          true
        ) as ColorWithFrequency[];

        // Update state with extracted colors
        setPokemonList((prev) =>
          prev.map((p) =>
            p.id === pokemon.id
              ? { ...p, extractedColors: colors, extracted: true }
              : p
          )
        );

        colorsToUpdate = colors.slice(0, 3).map((c) => c.hex);
      } catch (err) {
        console.error(`Error extracting colors for ${pokemon.name}:`, err);
        setUpdating(null);
        alert("Failed to extract colors. Please try again.");
        return;
      }
    }

    // Update with extracted colors
    setUpdating(pokemon.id);
    try {
      const response = await fetch("/api/admin/pokemon-colors", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pokemonId: pokemon.id,
          colors: colorsToUpdate,
          isShiny: isShinyMode,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update colors");
      }

      // Update local state
      setPokemonList((prev) =>
        prev.map((p) =>
          p.id === pokemon.id
            ? isShinyMode
              ? { ...p, staticShinyColors: colorsToUpdate.slice(0, 3) }
              : { ...p, staticColors: colorsToUpdate.slice(0, 3) }
            : p
        )
      );
    } catch (err) {
      console.error("Error updating colors:", err);
      alert("Failed to update colors. Please try again.");
    } finally {
      setUpdating(null);
    }
  };

  const filteredPokemon = useMemo(() => {
    let filtered = pokemonList;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.id.toString().includes(query)
      );
    }

    // Filter by ID range
    if (minId) {
      const min = parseInt(minId, 10);
      if (!isNaN(min)) {
        filtered = filtered.filter((p) => p.id >= min);
      }
    }

    if (maxId) {
      const max = parseInt(maxId, 10);
      if (!isNaN(max)) {
        filtered = filtered.filter((p) => p.id <= max);
      }
    }

    return filtered;
  }, [pokemonList, searchQuery, minId, maxId]);

  const handleBatchUpdate = async () => {
    const pokemonToProcess = filteredPokemon.filter((p) => 
      isShinyMode ? p.shinySpriteUrl : p.spriteUrl
    );
    
    if (pokemonToProcess.length === 0) {
      alert(`No Pokemon with ${isShinyMode ? 'shiny ' : ''}sprites to process`);
      return;
    }

    setBatchProcessing(true);
    setBatchProgress({ current: 0, total: pokemonToProcess.length });

    for (let i = 0; i < pokemonToProcess.length; i++) {
      const pokemon = pokemonToProcess[i];
      setBatchProgress({ current: i + 1, total: pokemonToProcess.length });

      try {
        const spriteUrl = isShinyMode ? pokemon.shinySpriteUrl! : pokemon.spriteUrl!;
        
        // Extract colors if not already extracted
        let colorsToUpdate: string[] = [];
        
        if (pokemon.extracted && pokemon.extractedColors.length > 0) {
          colorsToUpdate = pokemon.extractedColors.slice(0, 3).map((c) => c.hex);
        } else {
          // Extract colors first
          const colors = await extractColorsFromImage(
            spriteUrl,
            3,
            true
          ) as ColorWithFrequency[];

          // Update state with extracted colors
          setPokemonList((prev) =>
            prev.map((p) =>
              p.id === pokemon.id
                ? { ...p, extractedColors: colors, extracted: true }
                : p
            )
          );

          colorsToUpdate = colors.slice(0, 3).map((c) => c.hex);
        }

        // Update with extracted colors
        const response = await fetch("/api/admin/pokemon-colors", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pokemonId: pokemon.id,
            colors: colorsToUpdate,
            isShiny: isShinyMode,
          }),
        });

        if (!response.ok) {
          console.error(`Failed to update colors for ${pokemon.name}`);
          continue;
        }

        // Update local state
        setPokemonList((prev) =>
          prev.map((p) =>
            p.id === pokemon.id
              ? isShinyMode
                ? { ...p, staticShinyColors: colorsToUpdate.slice(0, 3) }
                : { ...p, staticColors: colorsToUpdate.slice(0, 3) }
              : p
          )
        );

        // Small delay to avoid overwhelming the server
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (err) {
        console.error(`Error processing ${pokemon.name}:`, err);
        // Continue with next Pokemon even if one fails
      }
    }

    setBatchProcessing(false);
    setBatchProgress({ current: 0, total: 0 });
    alert(`Batch update completed! Processed ${pokemonToProcess.length} Pokemon.`);
  };


  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div
            className="flex items-center justify-center"
            role="status"
            aria-live="polite"
          >
            <Loader2
              className="size-6 animate-spin"
              aria-hidden="true"
            />
            <span className="ml-2">Loading Pokémon data…</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card role="alert" aria-live="polite">
        <CardContent className="p-6">
          <div className="text-destructive">{error}</div>
        </CardContent>
      </Card>
    );
  }

  const spriteCount = filteredPokemon.filter((p) =>
    isShinyMode ? p.shinySpriteUrl : p.spriteUrl,
  ).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[220px] space-y-1.5">
              <label
                htmlFor="color-search"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Search
              </label>
              <Input
                id="color-search"
                type="search"
                inputMode="search"
                spellCheck={false}
                autoComplete="off"
                placeholder="Name or ID, e.g. pikachu or 25…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                ID Range
              </span>
              <div className="flex items-center gap-2">
                <Input
                  aria-label="Minimum Pokémon ID"
                  type="number"
                  inputMode="numeric"
                  placeholder="Min"
                  value={minId}
                  onChange={(e) => setMinId(e.target.value)}
                  className="w-24 tabular-nums"
                  min="1"
                />
                <span aria-hidden="true" className="text-muted-foreground">
                  –
                </span>
                <Input
                  aria-label="Maximum Pokémon ID"
                  type="number"
                  inputMode="numeric"
                  placeholder="Max"
                  value={maxId}
                  onChange={(e) => setMaxId(e.target.value)}
                  className="w-24 tabular-nums"
                  min="1"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Shiny Mode
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={isShinyMode}
                  aria-label="Toggle shiny mode"
                  onClick={() => {
                    setIsShinyMode(!isShinyMode);
                    setPokemonList((prev) =>
                      prev.map((p) => ({
                        ...p,
                        extractedColors: [],
                        extracted: false,
                      })),
                    );
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    isShinyMode ? "bg-yellow-500" : "bg-muted"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`inline-block size-4 transform rounded-full bg-white transition-transform ${
                      isShinyMode ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="text-sm text-muted-foreground">
                  {isShinyMode ? "Shiny" : "Normal"}
                </span>
              </div>
            </div>
            <Button
              onClick={handleBatchUpdate}
              disabled={batchProcessing || spriteCount === 0}
              variant="default"
            >
              {batchProcessing ? (
                <>
                  <Loader2
                    className="mr-2 size-4 animate-spin"
                    aria-hidden="true"
                  />
                  <span className="tabular-nums">
                    Processing {batchProgress.current}/{batchProgress.total}…
                  </span>
                </>
              ) : (
                `Batch Update All${isShinyMode ? " (Shiny)" : ""}`
              )}
            </Button>
          </div>
          <div
            className="text-sm text-muted-foreground tabular-nums"
            aria-live="polite"
          >
            Showing {filteredPokemon.length.toLocaleString()} of{" "}
            {pokemonList.length.toLocaleString()} Pokémon
            {spriteCount > 0
              ? ` · ${spriteCount.toLocaleString()} with ${
                  isShinyMode ? "shiny " : ""
                }sprites`
              : ""}
            {batchProcessing
              ? ` · Updating ${isShinyMode ? "shiny " : ""}colors…`
              : ""}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>{isShinyMode ? "Shiny " : ""}Sprite</TableHead>
                    <TableHead>Static {isShinyMode ? "Shiny " : ""}Colors</TableHead>
                    <TableHead>Extracted Colors</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPokemon.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No Pokémon found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPokemon.map((pokemon) => (
                    <TableRow key={pokemon.id}>
                      <TableCell className="font-mono tabular-nums" translate="no">#{pokemon.id}</TableCell>
                      <TableCell className="font-medium capitalize">{pokemon.name}</TableCell>
                      <TableCell>
                        {(isShinyMode ? pokemon.shinySpriteUrl : pokemon.spriteUrl) ? (
                          <div className="relative w-16 h-16 flex items-center justify-center">
                            <Image
                              src={(isShinyMode ? pokemon.shinySpriteUrl : pokemon.spriteUrl)!}
                              alt={`${isShinyMode ? "Shiny " : ""}${pokemon.name}`}
                              width={64}
                              height={64}
                              className="object-contain"
                              style={{
                                imageRendering: "pixelated",
                              }}
                              unoptimized
                            />
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {(isShinyMode ? pokemon.staticShinyColors : pokemon.staticColors).map((color, idx) => (
                            <div
                              key={idx}
                              className="size-8 rounded border"
                              style={{ backgroundColor: color }}
                              title={color}
                              aria-label={`Static color ${idx + 1}: ${color}`}
                            />
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {pokemon.extracting ? (
                          <Loader2
                            className="size-4 animate-spin"
                            aria-label="Extracting colors"
                          />
                        ) : pokemon.extracted && pokemon.extractedColors.length > 0 ? (
                          <div className="flex gap-1">
                            {pokemon.extractedColors.slice(0, 3).map((color, idx) => (
                              <div
                                key={idx}
                                className="size-8 rounded border"
                                style={{ backgroundColor: color.hex }}
                                title={`${color.hex} (${color.percentage.toFixed(1)}%)`}
                                aria-label={`Extracted color ${idx + 1}: ${color.hex}, ${color.percentage.toFixed(1)}%`}
                              />
                            ))}
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => extractColorsForPokemon(pokemon)}
                            disabled={!(isShinyMode ? pokemon.shinySpriteUrl : pokemon.spriteUrl)}
                          >
                            Extract
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleUpdateColors(pokemon)}
                          disabled={!(isShinyMode ? pokemon.shinySpriteUrl : pokemon.spriteUrl) || updating === pokemon.id}
                        >
                          {updating === pokemon.id ? (
                            <>
                              <Loader2
                                className="mr-2 size-4 animate-spin"
                                aria-hidden="true"
                              />
                              Updating…
                            </>
                          ) : (
                            "Update Colors"
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

