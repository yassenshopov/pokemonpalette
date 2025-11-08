"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { PokemonMetadata } from "@/types/pokemon";
import { getPokemonById } from "@/lib/pokemon";
import { Copy, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Helper function to determine if text should be dark or light based on background
const getTextColor = (hex: string): "text-white" | "text-black" => {
  if (!hex) return "text-white";
  const hexClean = hex.replace("#", "");
  const r = parseInt(hexClean.substring(0, 2), 16);
  const g = parseInt(hexClean.substring(2, 4), 16);
  const b = parseInt(hexClean.substring(4, 6), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return white for dark colors, black for light colors
  return luminance > 0.5 ? "text-black" : "text-white";
};

interface PokemonPaletteExploreCardProps {
  metadata: PokemonMetadata;
  onLoad?: (pokemon: any) => void;
}

export function PokemonPaletteExploreCard({
  metadata,
  onLoad,
}: PokemonPaletteExploreCardProps) {
  const [pokemon, setPokemon] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Lazy load Pokemon data when card comes into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !pokemon && !loading) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: "100px" } // Start loading 100px before card is visible
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, [pokemon, loading]);

  // Load Pokemon data when visible
  useEffect(() => {
    if (!isVisible || pokemon) return;

    const loadPokemon = async () => {
      setLoading(true);
      try {
        const data = await getPokemonById(metadata.id);
        if (data) {
          setPokemon(data);
          onLoad?.(data);
        }
      } catch (error) {
        console.error(`Failed to load Pokemon ${metadata.id}:`, error);
      } finally {
        setLoading(false);
      }
    };
    loadPokemon();
  }, [isVisible, metadata.id, onLoad, pokemon]);

  const handleCopyColor = async (color: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(color);
      setCopiedColor(color);
      setTimeout(() => setCopiedColor(null), 2000);
      toast.success("Color copied!");
    } catch (error) {
      toast.error("Failed to copy color");
    }
  };

  if (loading || !pokemon) {
    return (
      <div ref={cardRef} className="w-full">
        <div className="rounded-xl border bg-card overflow-hidden animate-pulse">
          <div className="h-48 bg-muted" />
          <div className="p-4 space-y-3">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/2" />
            <div className="flex gap-2 mt-2">
              <div className="h-6 bg-muted rounded w-16" />
              <div className="h-6 bg-muted rounded w-16" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const palette = pokemon?.colorPalette;
  const colors = palette?.highlights || [
    palette?.primary,
    palette?.secondary,
    palette?.accent,
  ].filter(Boolean) || [];

  const primaryColor = palette?.primary || "#6366f1";
  const officialArtwork =
    pokemon && typeof pokemon.artwork === "object" && "official" in pokemon.artwork
      ? pokemon.artwork.official
      : pokemon?.artwork?.official || null;

  return (
    <div ref={cardRef} className="w-full">
      <Link
        href={`/${metadata.name.toLowerCase()}`}
        className="group rounded-xl border bg-card overflow-hidden hover:shadow-lg transition-all duration-300 hover:scale-[1.02] block"
      >
      {/* Color Palette Strip */}
      <div className="h-32 md:h-40 relative overflow-hidden">
        <div className="flex h-full">
          {colors.length > 0 ? (
            colors.slice(0, 5).map((color, index) => (
              <div
                key={index}
                className="flex-1 h-full relative group/color"
                style={{ backgroundColor: color }}
                onClick={(e) => handleCopyColor(color, e)}
              >
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/color:opacity-100 transition-opacity bg-black/20">
                  <button
                    className="p-2 rounded-full bg-white/90 hover:bg-white transition-colors"
                    onClick={(e) => handleCopyColor(color, e)}
                  >
                    {copiedColor === color ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-800" />
                    )}
                  </button>
                </div>
                <div className="absolute bottom-2 left-2 opacity-0 group-hover/color:opacity-100 transition-opacity">
                  <span
                    className={`text-xs font-mono px-2 py-1 rounded backdrop-blur-sm ${
                      getTextColor(color) === "text-white"
                        ? "bg-black/30 text-white"
                        : "bg-white/30 text-black"
                    }`}
                  >
                    {color}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div
              className="w-full h-full"
              style={{ backgroundColor: primaryColor }}
            />
          )}
        </div>

        {/* Pokemon Image Overlay */}
        {officialArtwork && !imageError && pokemon && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-32 h-32 md:w-40 md:h-40 opacity-20 group-hover:opacity-30 transition-opacity">
              <Image
                src={officialArtwork}
                alt={pokemon.name}
                fill
                className="object-contain"
                onError={() => setImageError(true)}
              />
            </div>
          </div>
        )}

        {/* Pokemon Number Badge */}
        <div className="absolute top-2 right-2">
          <Badge
            variant="secondary"
            className="bg-black/50 text-white backdrop-blur-sm"
          >
            #{metadata.id.toString().padStart(3, "0")}
          </Badge>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors">
              {pokemon?.name || metadata.name}
            </h3>
            <p className="text-sm text-muted-foreground truncate">
              {pokemon?.species || metadata.species}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            onClick={(e) => {
              e.preventDefault();
              window.open(`/${metadata.name.toLowerCase()}`, "_blank");
            }}
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>

        {/* Types */}
        <div className="flex flex-wrap gap-2">
          {(pokemon?.type || metadata.type).map((type: string, index: number) => (
            <Badge
              key={type}
              variant="outline"
              className="text-xs"
              style={{
                borderColor:
                  colors[index % colors.length] || primaryColor + "40",
              }}
            >
              {type}
            </Badge>
          ))}
        </div>

        {/* Color Codes */}
        <div className="flex flex-wrap gap-1 pt-2 border-t">
          {colors.slice(0, 3).map((color, index) => (
            <button
              key={index}
              onClick={(e) => handleCopyColor(color, e)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-muted transition-colors group/btn"
            >
              <div
                className="w-3 h-3 rounded border"
                style={{ backgroundColor: color }}
              />
              <span className="font-mono text-muted-foreground group-hover/btn:text-foreground">
                {color}
              </span>
              {copiedColor === color && (
                <Check className="w-3 h-3 text-green-600" />
              )}
            </button>
          ))}
          {colors.length > 3 && (
            <span className="text-xs text-muted-foreground px-2 py-1">
              +{colors.length - 3} more
            </span>
          )}
        </div>
      </div>
    </Link>
    </div>
  );
}

