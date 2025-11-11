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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading Pokemon data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-red-500">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pokemon Color Management</CardTitle>
          <CardDescription>
            Compare static data colors with extracted sprite colors and update as needed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-4 flex-wrap">
              <Input
                placeholder="Search by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground whitespace-nowrap">
                  ID Range:
                </label>
                <Input
                  type="number"
                  placeholder="Min ID"
                  value={minId}
                  onChange={(e) => setMinId(e.target.value)}
                  className="w-24"
                  min="1"
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="number"
                  placeholder="Max ID"
                  value={maxId}
                  onChange={(e) => setMaxId(e.target.value)}
                  className="w-24"
                  min="1"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground whitespace-nowrap">
                  Shiny Mode:
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsShinyMode(!isShinyMode);
                    // Reset extracted colors when switching modes
                    setPokemonList((prev) =>
                      prev.map((p) => ({
                        ...p,
                        extractedColors: [],
                        extracted: false,
                      }))
                    );
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isShinyMode ? "bg-yellow-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isShinyMode ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="text-sm text-muted-foreground">
                  {isShinyMode ? "Shiny" : "Normal"}
                </span>
              </div>
              <Button
                onClick={handleBatchUpdate}
                disabled={batchProcessing || filteredPokemon.filter((p) => 
                  isShinyMode ? p.shinySpriteUrl : p.spriteUrl
                ).length === 0}
                variant="default"
              >
                {batchProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing {batchProgress.current}/{batchProgress.total}...
                  </>
                ) : (
                  `Batch Update All ${isShinyMode ? "(Shiny)" : ""}`
                )}
              </Button>
              {batchProcessing && (
                <span className="text-sm text-muted-foreground">
                  Updating {isShinyMode ? "shiny " : ""}colors for all Pokemon...
                </span>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              Showing {filteredPokemon.length} of {pokemonList.length} Pokemon
              {filteredPokemon.filter((p) => 
                isShinyMode ? p.shinySpriteUrl : p.spriteUrl
              ).length > 0 && (
                <span className="ml-2">
                  ({filteredPokemon.filter((p) => 
                    isShinyMode ? p.shinySpriteUrl : p.spriteUrl
                  ).length} with {isShinyMode ? "shiny " : ""}sprites)
                </span>
              )}
            </div>
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
                      No Pokemon found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPokemon.map((pokemon) => (
                    <TableRow key={pokemon.id}>
                      <TableCell className="font-mono">#{pokemon.id}</TableCell>
                      <TableCell className="font-medium">{pokemon.name}</TableCell>
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
                              className="w-8 h-8 rounded border border-gray-300"
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {pokemon.extracting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : pokemon.extracted && pokemon.extractedColors.length > 0 ? (
                          <div className="flex gap-1">
                            {pokemon.extractedColors.slice(0, 3).map((color, idx) => (
                              <div
                                key={idx}
                                className="w-8 h-8 rounded border border-gray-300"
                                style={{ backgroundColor: color.hex }}
                                title={`${color.hex} (${color.percentage.toFixed(1)}%)`}
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
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Updating...
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

