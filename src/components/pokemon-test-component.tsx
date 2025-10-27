"use client";

import { useState, useEffect } from "react";
import { Pokemon, PokemonMetadata } from "@/types/pokemon";
import { getAllPokemonMetadata, getPokemonById } from "@/lib/pokemon";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Palette, Sparkles } from "lucide-react";
import { PokemonExpandedView } from "./pokemon-expanded-view";

interface ColorPaletteProps {
  colors: string[];
  title: string;
}

function ColorPalette({ colors, title }: ColorPaletteProps) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">{title}</h4>
      <div className="flex flex-wrap gap-2">
        {colors.map((color, index) => (
          <div key={index} className="flex items-center space-x-2">
            <div
              className="w-8 h-8 rounded border shadow-sm"
              style={{ backgroundColor: color }}
              title={color}
            />
            <span className="text-xs font-mono text-muted-foreground">
              {color}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpritePaletteGenerator({ pokemon }: { pokemon: Pokemon }) {
  const [generatedPalette, setGeneratedPalette] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePaletteFromSprite = async () => {
    setIsGenerating(true);
    try {
      // Create a canvas to analyze the sprite
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        const colorMap = new Map<string, number>();

        // Sample colors from the image
        for (let i = 0; i < pixels.length; i += 16) {
          // Sample every 4th pixel
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];

          // Skip transparent pixels
          if (a < 128) continue;

          const color = `rgb(${r}, ${g}, ${b})`;
          colorMap.set(color, (colorMap.get(color) || 0) + 1);
        }

        // Get the most common colors
        const sortedColors = Array.from(colorMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([color]) => color);

        setGeneratedPalette(sortedColors);
        setIsGenerating(false);
      };

      img.onerror = () => {
        setIsGenerating(false);
        console.error("Failed to load sprite image");
      };

      // Handle both old and new artwork formats
      const frontUrl =
        "front" in pokemon.artwork && pokemon.artwork.front
          ? pokemon.artwork.front
          : "official" in pokemon.artwork
          ? pokemon.artwork.official
          : "";
      img.src = frontUrl;
    } catch (error) {
      console.error("Error generating palette:", error);
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Palette className="h-5 w-5" />
          <span>Sprite Color Palette</span>
        </CardTitle>
        <CardDescription>
          Generate a color palette from the Pokemon&apos;s sprite
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center">
          <img
            src={pokemon.artwork.front}
            alt={`${pokemon.name} sprite`}
            className="w-32 h-32 object-contain"
            onLoad={() => {
              if (generatedPalette.length === 0) {
                generatePaletteFromSprite();
              }
            }}
          />
        </div>

        <div className="flex justify-center">
          <button
            onClick={generatePaletteFromSprite}
            disabled={isGenerating}
            className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span>{isGenerating ? "Generating..." : "Generate Palette"}</span>
          </button>
        </div>

        {generatedPalette.length > 0 && (
          <ColorPalette colors={generatedPalette} title="Generated Colors" />
        )}
      </CardContent>
    </Card>
  );
}

export function PokemonTestComponent() {
  const [pokemonMetadata, setPokemonMetadata] = useState<PokemonMetadata[]>([]);
  const [selectedPokemonId, setSelectedPokemonId] = useState<number | null>(
    null
  );
  const [pokemon, setPokemon] = useState<Pokemon | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const metadata = getAllPokemonMetadata();
    setPokemonMetadata(metadata);
    if (metadata.length > 0) {
      setSelectedPokemonId(metadata[0].id);
    }
  }, []);

  useEffect(() => {
    if (selectedPokemonId) {
      setIsLoading(true);
      getPokemonById(selectedPokemonId).then((data) => {
        setPokemon(data);
        setIsLoading(false);
      });
    }
  }, [selectedPokemonId]);

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Pokemon Test Component</h1>
        <p className="text-muted-foreground">
          Select a Pokemon to view their data and generate color palettes from
          their sprite.
        </p>
      </div>

      <div className="mb-6">
        <label className="text-sm font-medium mb-2 block">Select Pokemon</label>
        <Select
          value={selectedPokemonId?.toString() || ""}
          onValueChange={(value) => setSelectedPokemonId(parseInt(value))}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a Pokemon..." />
          </SelectTrigger>
          <SelectContent>
            {pokemonMetadata.map((p) => (
              <SelectItem key={p.id} value={p.id.toString()}>
                #{p.id} - {p.name} ({p.type.join(", ")})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        </div>
      ) : pokemon ? (
        <>
          <PokemonExpandedView
            pokemon={pokemon}
            availablePokemonIds={pokemonMetadata.map((p) => p.id)}
            pokemonNameToId={(name) => {
              const found = pokemonMetadata.find(
                (p) => p.name.toLowerCase() === name.toLowerCase()
              );
              return found?.id;
            }}
            onEvolutionClick={(pokemonName) => {
              // Find Pokemon by name and load it
              const foundPkmn = pokemonMetadata.find(
                (p) => p.name.toLowerCase() === pokemonName.toLowerCase()
              );
              if (foundPkmn) {
                setSelectedPokemonId(foundPkmn.id);
              }
            }}
            onVarietyClick={(varietyId) => {
              // Load the variety's Pokemon data if it exists
              const varietyExists = pokemonMetadata.find(
                (p) => p.id === varietyId
              );
              if (varietyExists) {
                setSelectedPokemonId(varietyId);
              } else {
                // If variety doesn't exist locally, try to fetch from API or show message
                console.log(
                  `Variety ${varietyId} not available in local data. You may need to fetch it from the API.`
                );
                // Could implement API fetch here if needed
              }
            }}
          />

          {/* Keep the palette generator */}
          <div className="grid lg:grid-cols-2 gap-6">
            <SpritePaletteGenerator pokemon={pokemon} />
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Palette className="h-5 w-5" />
                  <span>Predefined Color Palette</span>
                </CardTitle>
                <CardDescription>
                  Colors extracted from Pokemon artwork
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ColorPalette
                  colors={[
                    pokemon.colorPalette.primary,
                    pokemon.colorPalette.secondary,
                    pokemon.colorPalette.accent,
                  ].filter(Boolean)}
                  title="Main Colors"
                />
                <Separator />
                <ColorPalette
                  colors={[...new Set(pokemon.colorPalette.highlights)].filter(
                    Boolean
                  )}
                  title="Highlight Colors"
                />
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Select a Pokemon to get started
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
