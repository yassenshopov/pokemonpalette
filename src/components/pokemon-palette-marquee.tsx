"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import { PokemonMetadata } from "@/types/pokemon";
import { getPokemonById, getAllPokemonMetadata } from "@/lib/pokemon";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface PokemonWithData {
  metadata: PokemonMetadata;
  pokemon: any;
  colors: string[];
}

// Helper function to determine if text should be dark or light based on background
const getTextColor = (hex: string): "text-white" | "text-black" => {
  if (!hex) return "text-white";
  const hexClean = hex.replace("#", "");
  const r = parseInt(hexClean.substring(0, 2), 16);
  const g = parseInt(hexClean.substring(2, 4), 16);
  const b = parseInt(hexClean.substring(4, 6), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "text-black" : "text-white";
};

interface PokemonPaletteMarqueeProps {
  count?: number;
  speed?: number;
  rows?: number;
}

export function PokemonPaletteMarquee({
  count = 30,
  speed = 120,
  rows = 5,
}: PokemonPaletteMarqueeProps) {
  const [pokemonList, setPokemonList] = useState<PokemonWithData[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  const [pausedRows, setPausedRows] = useState<Set<number>>(new Set());
  const marqueeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animationRefs = useRef<(gsap.core.Tween | null)[]>([]);

  // Get random Pokemon - load enough for all rows
  useEffect(() => {
    const loadRandomPokemon = async () => {
      setLoading(true);
      const allMetadata = getAllPokemonMetadata();
      
      // Load more Pokemon to ensure we have enough for all rows
      // Each row needs duplicates, so we need at least count * 3 to be safe
      const pokemonNeeded = count * 3;
      const shuffled = [...allMetadata].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, Math.min(pokemonNeeded, allMetadata.length));

      const pokemonPromises = selected.map(async (metadata) => {
        try {
          const pokemon = await getPokemonById(metadata.id);
          if (!pokemon) return null;

          const palette = pokemon.colorPalette;
          const colors = palette?.highlights || [
            palette?.primary,
            palette?.secondary,
            palette?.accent,
          ].filter(Boolean) || [];

          return {
            metadata,
            pokemon,
            colors: colors.length > 0 ? colors : [palette?.primary || "#6366f1"],
          };
        } catch (error) {
          console.error(`Failed to load Pokemon ${metadata.id}:`, error);
          return null;
        }
      });

      const results = await Promise.all(pokemonPromises);
      const validResults = results.filter(
        (r): r is PokemonWithData => r !== null
      );
      
      setPokemonList(validResults);
      setLoading(false);
    };

    loadRandomPokemon();
  }, [count]);

  // Initialize refs arrays
  useEffect(() => {
    marqueeRefs.current = new Array(rows).fill(null);
    animationRefs.current = new Array(rows).fill(null);
  }, [rows]);

  // Handle pause/resume on hover
  useEffect(() => {
    pausedRows.forEach((rowIndex) => {
      animationRefs.current[rowIndex]?.pause();
    });
    
    animationRefs.current.forEach((anim, index) => {
      if (!pausedRows.has(index)) {
        anim?.resume();
      }
    });
  }, [pausedRows]);

  // Animate marquees
  useEffect(() => {
    if (loading || pokemonList.length === 0) return;

    // Small delay to ensure DOM is ready and images can start loading
    const timeoutId = setTimeout(() => {
      // Animate each row
      marqueeRefs.current.forEach((ref, index) => {
        if (!ref) return;

        // Calculate width based on the actual content
        // Since we duplicate items, we need to move by half the total width
        const totalWidth = ref.scrollWidth;
        const width = totalWidth / 2;
        
        // Kill existing animation
        if (animationRefs.current[index]) {
          animationRefs.current[index]?.kill();
        }

        // Reset position
        gsap.set(ref, { x: 0 });

        // Alternate direction: even indices go left to right, odd go right to left
        const isLeftToRight = index % 2 === 0;
        
        animationRefs.current[index] = gsap.to(ref, {
          x: isLeftToRight ? -width : width,
          duration: speed,
          ease: "none",
          repeat: -1,
        });
      });
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      animationRefs.current.forEach((anim) => anim?.kill());
    };
  }, [loading, pokemonList, speed, rows]);

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

  if (loading) {
    return (
      <div className="w-full py-12 flex items-center justify-center">
        <div className="text-muted-foreground">Loading palettes...</div>
      </div>
    );
  }

  // Get items for each row - ensure infinite scrolling with enough cards for all rows
  const getRowItems = (rowIndex: number) => {
    if (pokemonList.length === 0) return [];
    
    const rowItems: PokemonWithData[] = [];
    
    // Shuffle the starting point for each row to ensure variety
    const startOffset = (rowIndex * 17) % pokemonList.length; // Use prime number for better distribution
    
    // Create enough items for seamless scrolling
    // We need at least enough to cover 2 full screen widths + buffer
    // Each card is ~256px (w-64) + gap, so ~280px per card
    // For a 4K screen (3840px), we need ~14 cards visible
    // We'll create enough cycles to have 40+ items per row minimum
    const minItemsPerRow = 40;
    const cyclesNeeded = Math.max(3, Math.ceil(minItemsPerRow / pokemonList.length));
    
    // Build the base set by cycling through all Pokemon
    for (let cycle = 0; cycle < cyclesNeeded; cycle++) {
      for (let i = 0; i < pokemonList.length; i++) {
        const index = (startOffset + i) % pokemonList.length;
        rowItems.push(pokemonList[index]);
      }
    }
    
    // Duplicate 3 times for seamless infinite loop
    // This ensures we have enough content that the animation never runs out
    return [...rowItems, ...rowItems, ...rowItems];
  };

  return (
    <div className="w-full space-y-6 md:space-y-8 overflow-hidden">
      {Array.from({ length: rows }).map((_, rowIndex) => {
        const isLeftToRight = rowIndex % 2 === 0;
        const rowItems = getRowItems(rowIndex);
        
        return (
          <div 
            key={rowIndex} 
            className="relative"
            onMouseEnter={() => setPausedRows((prev) => new Set(prev).add(rowIndex))}
            onMouseLeave={() => setPausedRows((prev) => {
              const next = new Set(prev);
              next.delete(rowIndex);
              return next;
            })}
          >
            {/* Fade gradients */}
            <div className="absolute left-0 top-0 bottom-0 w-32 md:w-48 bg-gradient-to-r from-background via-background/80 to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-32 md:w-48 bg-gradient-to-l from-background via-background/80 to-transparent z-10 pointer-events-none" />
            
            <div className="flex overflow-hidden">
              <div
                ref={(el) => {
                  marqueeRefs.current[rowIndex] = el;
                }}
                className="flex gap-4 md:gap-6"
                style={{ willChange: "transform" }}
              >
                {rowItems.map((item, index) => {
              const officialArtwork =
                item.pokemon &&
                typeof item.pokemon.artwork === "object" &&
                "official" in item.pokemon.artwork
                  ? item.pokemon.artwork.official
                  : item.pokemon?.artwork?.official || null;

                  const primaryColor = item.colors[0] || "#6366f1";

                  return (
                    <Link
                      key={`row-${rowIndex}-${item.metadata.id}-${index}`}
                      href={`/${item.metadata.name.toLowerCase()}`}
                      className="group flex-shrink-0 w-48 md:w-64 hover:scale-105 transition-transform duration-300"
                    >
                  <div className="relative rounded-xl border bg-card overflow-hidden">
                    {/* Color Swatches */}
                    <div className="flex h-24 md:h-32">
                      {item.colors.slice(0, 5).map((color, colorIndex) => (
                        <div
                          key={colorIndex}
                          className="flex-1 h-full relative group/color"
                          style={{ backgroundColor: color }}
                          onClick={(e) => handleCopyColor(color, e)}
                        >
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/color:opacity-100 transition-opacity bg-black/20">
                            <button
                              className="p-1.5 rounded-full bg-white/90 hover:bg-white transition-colors"
                              onClick={(e) => handleCopyColor(color, e)}
                            >
                              {copiedColor === color ? (
                                <Check className="w-3 h-3 text-green-600" />
                              ) : (
                                <Copy className="w-3 h-3 text-gray-800" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pokemon Artwork Overlay */}
                    {officialArtwork && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="relative w-32 h-32 md:w-40 md:h-40 opacity-30 group-hover:opacity-40 transition-opacity">
                          <Image
                            src={officialArtwork}
                            alt={item.metadata.name}
                            fill
                            className="object-contain"
                            loading="lazy"
                            unoptimized
                          />
                        </div>
                      </div>
                    )}

                    {/* Pokemon Info */}
                    <div className="p-3 md:p-4 bg-card/95 backdrop-blur-sm">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-sm md:text-base truncate">
                          {item.metadata.name}
                        </h3>
                        <Badge
                          variant="secondary"
                          className="text-xs bg-black/50 text-white"
                        >
                          #{item.metadata.id.toString().padStart(3, "0")}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {item.metadata.type.map((type) => (
                          <Badge
                            key={type}
                            variant="outline"
                            className="text-xs"
                            style={{
                              borderColor: primaryColor + "40",
                            }}
                          >
                            {type}
                          </Badge>
                        ))}
                      </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      );
      })}
    </div>
  );
}

