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
  staticColors: string[];
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
  const [updating, setUpdating] = useState<number | null>(null);

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
    if (!pokemon.spriteUrl || pokemon.extracted) return;

    setPokemonList((prev) =>
      prev.map((p) =>
        p.id === pokemon.id ? { ...p, extracting: true } : p
      )
    );

    try {
      const colors = await extractColorsFromImage(
        pokemon.spriteUrl,
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

  const openColorSelector = (pokemon: PokemonWithExtractedColors) => {
    // Extract colors if not already extracted
    if (!pokemon.extracted && pokemon.spriteUrl) {
      extractColorsForPokemon(pokemon);
    }
    
    setSelectedPokemon(pokemon);
    // Pre-select the current static colors
    setSelectedColors([...pokemon.staticColors]);
    setDialogOpen(true);
  };

  const handleColorToggle = (color: string) => {
    setSelectedColors((prev) => {
      if (prev.includes(color)) {
        return prev.filter((c) => c !== color);
      } else {
        const newColors = [...prev, color];
        return newColors.slice(0, 3); // Max 3 colors
      }
    });
  };

  const handleUpdateColors = async () => {
    if (!selectedPokemon || selectedColors.length === 0) return;

    setUpdating(selectedPokemon.id);
    try {
      const response = await fetch("/api/admin/pokemon-colors", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pokemonId: selectedPokemon.id,
          colors: selectedColors,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update colors");
      }

      // Update local state
      setPokemonList((prev) =>
        prev.map((p) =>
          p.id === selectedPokemon.id
            ? { ...p, staticColors: selectedColors.slice(0, 3) }
            : p
        )
      );

      setDialogOpen(false);
      setSelectedPokemon(null);
      setSelectedColors([]);
    } catch (err) {
      console.error("Error updating colors:", err);
      alert("Failed to update colors. Please try again.");
    } finally {
      setUpdating(null);
    }
  };

  const filteredPokemon = useMemo(() => {
    if (!searchQuery) return pokemonList;
    const query = searchQuery.toLowerCase();
    return pokemonList.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.id.toString().includes(query)
    );
  }, [pokemonList, searchQuery]);

  const allColors = useMemo(() => {
    if (!selectedPokemon) return [];
    const staticSet = new Set(selectedPokemon.staticColors);
    const extractedSet = new Set(
      selectedPokemon.extractedColors.map((c) => c.hex)
    );
    const all = new Set([...staticSet, ...extractedSet]);
    return Array.from(all);
  }, [selectedPokemon]);

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
          <div className="mb-4">
            <Input
              placeholder="Search by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Sprite</TableHead>
                  <TableHead>Static Colors</TableHead>
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
                        {pokemon.spriteUrl ? (
                          <div className="relative w-16 h-16 flex items-center justify-center">
                            <Image
                              src={pokemon.spriteUrl}
                              alt={pokemon.name}
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
                          {pokemon.staticColors.map((color, idx) => (
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
                            disabled={!pokemon.spriteUrl}
                          >
                            Extract
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => openColorSelector(pokemon)}
                          disabled={!pokemon.spriteUrl}
                        >
                          Update Colors
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Update Colors for {selectedPokemon?.name} (#{selectedPokemon?.id})
            </DialogTitle>
            <DialogDescription>
              Select up to 3 colors to update in the static data
            </DialogDescription>
          </DialogHeader>

          {selectedPokemon && (
            <div className="space-y-4">
              {selectedPokemon.spriteUrl && (
                <div>
                  <h4 className="font-semibold mb-2">2D Sprite</h4>
                  <div className="flex items-center justify-center p-4 bg-muted rounded-lg">
                    <div className="relative w-32 h-32 flex items-center justify-center">
                      <Image
                        src={selectedPokemon.spriteUrl}
                        alt={selectedPokemon.name}
                        width={128}
                        height={128}
                        className="object-contain"
                        style={{
                          imageRendering: "pixelated",
                        }}
                        unoptimized
                      />
                    </div>
                  </div>
                </div>
              )}
              <div>
                <h4 className="font-semibold mb-2">Static Data Colors (Current)</h4>
                <div className="flex gap-2 flex-wrap">
                  {selectedPokemon.staticColors.map((color, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 border rounded"
                    >
                      <div
                        className="w-12 h-12 rounded border border-gray-300"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-sm font-mono">{color}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedPokemon.extracted && selectedPokemon.extractedColors.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Extracted Sprite Colors</h4>
                  <div className="flex gap-2 flex-wrap">
                    {selectedPokemon.extractedColors.map((color, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 border rounded"
                      >
                        <div
                          className="w-12 h-12 rounded border border-gray-300"
                          style={{ backgroundColor: color.hex }}
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-mono">{color.hex}</span>
                          <span className="text-xs text-muted-foreground">
                            {color.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-semibold mb-2">Select Colors to Update (Max 3)</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {allColors.map((color) => {
                    const isStatic = selectedPokemon.staticColors.includes(color);
                    const extractedColor = selectedPokemon.extractedColors.find(
                      (c) => c.hex === color
                    );
                    const isSelected = selectedColors.includes(color);

                    return (
                      <div
                        key={color}
                        className="flex items-center gap-3 p-2 border rounded hover:bg-accent cursor-pointer"
                        onClick={() => handleColorToggle(color)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleColorToggle(color)}
                        />
                        <div
                          className="w-10 h-10 rounded border border-gray-300"
                          style={{ backgroundColor: color }}
                        />
                        <div className="flex-1">
                          <div className="font-mono text-sm">{color}</div>
                          <div className="text-xs text-muted-foreground">
                            {isStatic && "Static Data"}
                            {extractedColor && ` • ${extractedColor.percentage.toFixed(1)}%`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Selected: {selectedColors.length} / 3
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    setSelectedPokemon(null);
                    setSelectedColors([]);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateColors}
                  disabled={selectedColors.length === 0 || updating === selectedPokemon.id}
                >
                  {updating === selectedPokemon.id ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Updating...
                    </>
                  ) : (
                    "Update Colors"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

