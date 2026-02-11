"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";
import Image from "next/image";
import Link from "next/link";
import { getAllPokemonMetadata, getPokemonById } from "@/lib/pokemon";
import type { Pokemon } from "@/types/pokemon";

interface CellPalette {
  pokemon: Pokemon;
  colors: string[];
}

export function GridPattern() {
  const rows = 8;
  const cols = 3;
  const totalCells = rows * cols;
  
  const [palettes, setPalettes] = useState<Map<number, CellPalette>>(new Map());
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);
  const allMetadata = getAllPokemonMetadata();
  const paletteRefs = useRef<(HTMLDivElement | null)[]>([]);
  const expandedRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);

  // All cells should have palettes
  const cellsWithPalettes = useMemo(() => {
    return Array.from({ length: totalCells }, (_, i) => i);
  }, [totalCells]);

  // Helper function to load a single palette
  const loadPalette = async (cellIndex: number): Promise<CellPalette | null> => {
    const randomMetadata = allMetadata[Math.floor(Math.random() * allMetadata.length)];
    if (!randomMetadata) return null;

    try {
      const pokemon = await getPokemonById(randomMetadata.id);
      if (pokemon?.colorPalette) {
        const palette = pokemon.colorPalette;
        const colors = palette.highlights || [
          palette.primary,
          palette.secondary,
          palette.accent,
        ].filter(Boolean) || [];
        
        if (colors.length > 0 && pokemon) {
          return {
            pokemon: pokemon,
            colors: colors.slice(0, 6), // Up to 6 colors
          };
        }
      }
    } catch (error) {
      console.error(`Failed to load palette for cell ${cellIndex}:`, error);
    }
    return null;
  };

  // Load palettes for cells that should have them
  useEffect(() => {
    const loadPalettes = async () => {
      const newPalettes = new Map<number, CellPalette>();
      
      for (const cellIndex of cellsWithPalettes) {
        const palette = await loadPalette(cellIndex);
        if (palette) {
          newPalettes.set(cellIndex, palette);
        }
      }
      
      setPalettes(newPalettes);
    };

    loadPalettes();
  }, [cellsWithPalettes, allMetadata]);

  // Randomize some palettes every few seconds
  useEffect(() => {
    if (palettes.size === 0) return;

    const interval = setInterval(async () => {
      // Randomly select 3-5 cells to randomize
      const cellsToUpdate = [...cellsWithPalettes]
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.floor(Math.random() * 3) + 3); // 3-5 cells

      const updates = new Map<number, CellPalette>();
      
      for (const cellIndex of cellsToUpdate) {
        // Skip if currently hovered
        if (cellIndex === hoveredCell) continue;
        
        const newPalette = await loadPalette(cellIndex);
        if (newPalette) {
          updates.set(cellIndex, newPalette);
        }
      }

      if (updates.size > 0) {
        // Animate color transitions smoothly
        updates.forEach((newPalette, cellIndex) => {
          const paletteDiv = paletteRefs.current[cellIndex];
          if (paletteDiv) {
            const colorDivs = paletteDiv.querySelectorAll<HTMLElement>("div[style*='background-color']");
            
            // Fade out
            gsap.to(paletteDiv, {
              opacity: 0.1,
              duration: 0.4,
              ease: "power2.in",
              onComplete: () => {
                // Update palette
                setPalettes((prev) => {
                  const updated = new Map(prev);
                  updated.set(cellIndex, newPalette);
                  return updated;
                });
                
                // Fade back in to dim
                gsap.to(paletteDiv, {
                  opacity: 0.25,
                  duration: 0.4,
                  ease: "power2.out",
                });
              },
            });
          }
        });
      }
    }, 4000); // Randomize every 4 seconds

    return () => clearInterval(interval);
  }, [palettes, cellsWithPalettes, hoveredCell, allMetadata]);

  // Calculate cell dimensions
  const cellWidth = 100 / cols;
  const cellHeight = 100 / rows;

  // Animate palettes when they load
  useEffect(() => {
    if (palettes.size > 0) {
      const paletteDivs = paletteRefs.current.filter((ref) => ref !== null);

      if (paletteDivs.length > 0) {
        // Set initial state
        gsap.set(paletteDivs, { opacity: 0, scale: 0.8 });

        // Animate in with stagger - start dim
        gsap.to(paletteDivs, {
          opacity: 0.25, // Dimmed default opacity
          scale: 1,
          duration: 0.6,
          stagger: 0.03,
          ease: "power2.out",
          onComplete: () => {
            // Set dim opacity as default
            paletteDivs.forEach((div) => {
              if (div) {
                div.style.opacity = "0.25";
              }
            });
          },
        });
      }
    }
  }, [palettes]);

  // Animate row expansion and dimming on hover
  useEffect(() => {
    if (hoveredCell !== null) {
      const hoveredRow = Math.floor(hoveredCell / cols);
      const expandedCard = expandedRefs.current[hoveredCell];
      const expansionAmount = cellHeight * 1.5; // Additional height (2.5x - 1x = 1.5x)
      
      // Expand all cells in the same row and shift rows below
      cellRefs.current.forEach((cell, index) => {
        if (cell) {
          const cellRow = Math.floor(index / cols);
          const isInHoveredRow = cellRow === hoveredRow;
          const isBelowHoveredRow = cellRow > hoveredRow;
          const isHoveredCell = index === hoveredCell;
          
          if (isInHoveredRow) {
            // Expand all cells in the row
            gsap.to(cell, {
              height: `${cellHeight * 2.5}%`,
              duration: 0.4,
              ease: "power2.out",
            });
            
            // Dim neighboring cells (not the hovered one)
            if (!isHoveredCell) {
              const paletteDiv = paletteRefs.current[index];
              if (paletteDiv) {
                gsap.to(paletteDiv, {
                  opacity: 0.15,
                  duration: 0.3,
                  ease: "power2.out",
                });
              }
            } else {
              // Keep hovered cell at full opacity
              const paletteDiv = paletteRefs.current[index];
              if (paletteDiv) {
                gsap.to(paletteDiv, {
                  opacity: 1,
                  duration: 0.3,
                  ease: "power2.out",
                });
              }
            }
          } else if (isBelowHoveredRow) {
            // Shift rows below down by the expansion amount
            const originalTop = cellRow * cellHeight;
            gsap.to(cell, {
              top: `${originalTop + expansionAmount}%`,
              duration: 0.4,
              ease: "power2.out",
            });
          }
        }
      });
      
      if (expandedCard) {
        gsap.fromTo(
          expandedCard,
          { opacity: 0, scale: 0.9 },
          { opacity: 1, scale: 1, duration: 0.3, delay: 0.1, ease: "power2.out" }
        );
      }
    } else {
      // Reset all cells to original height, position, and opacity
      cellRefs.current.forEach((cell, index) => {
        if (cell) {
          const cellRow = Math.floor(index / cols);
          const originalTop = cellRow * cellHeight;
          
          gsap.to(cell, {
            height: `${cellHeight}%`,
            top: `${originalTop}%`,
            duration: 0.4,
            ease: "power2.out",
          });
          
          // Reset opacity to dim
          const paletteDiv = paletteRefs.current[index];
          if (paletteDiv) {
            gsap.to(paletteDiv, {
              opacity: 0.25,
              duration: 0.3,
              ease: "power2.out",
            });
          }
        }
      });
    }
  }, [hoveredCell, cellHeight, cols]);

  return (
    <div className="w-full h-full relative">
      {/* Grid cells with palettes */}
      {Array.from({ length: totalCells })
        .map((_, index) => {
          const palette = palettes.get(index);
          return palette ? { index, palette } : null;
        })
        .filter((item): item is { index: number; palette: CellPalette } => item !== null)
        .map(({ index, palette }) => {
          const row = Math.floor(index / cols);
          const col = index % cols;
          const isHovered = hoveredCell === index;
          const hoveredRow = hoveredCell !== null ? Math.floor(hoveredCell / cols) : null;
          const isInHoveredRow = hoveredRow !== null && row === hoveredRow;
          const officialArtwork =
            palette.pokemon &&
            typeof palette.pokemon.artwork === "object" &&
            "official" in palette.pokemon.artwork
              ? palette.pokemon.artwork.official
              : null;
          
          return (
            <div
              key={index}
              ref={(el) => {
                cellRefs.current[index] = el;
              }}
              className="absolute group z-10 overflow-hidden border border-dashed border-muted-foreground/30"
              style={{
                left: `${col * cellWidth}%`,
                top: `${row * cellHeight}%`,
                width: `${cellWidth}%`,
                height: `${cellHeight}%`,
              }}
              onMouseEnter={() => setHoveredCell(index)}
              onMouseLeave={() => {
                // Clear hover when leaving - onMouseEnter on adjacent cells will update it
                setHoveredCell(null);
              }}
            >
              {/* Color palette strip */}
                <div 
                  ref={(el) => {
                    paletteRefs.current[index] = el;
                  }}
                  className="w-full h-full flex"
                  style={{
                    opacity: isHovered ? 1 : isInHoveredRow ? 0.15 : 0.25,
                  }}
                >
                  {palette.colors.map((color, colorIndex) => (
                    <div
                      key={colorIndex}
                      className="flex-1 h-full transition-transform duration-300 group-hover:scale-y-105"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>

                {/* Expanded card inside cell on hover - overlays on top of palette */}
                {isHovered && (
                  <Link
                    href={`/${palette.pokemon.name.toLowerCase()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 flex items-center justify-center z-20 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      ref={(el) => {
                        expandedRefs.current[index] = el;
                      }}
                      className="w-full h-full flex flex-col items-center justify-center p-4"
                    >
                      {/* Pokemon Artwork */}
                      {officialArtwork && (
                        <div className="flex justify-center mb-3">
                          <div className="relative w-24 h-24 drop-shadow-lg">
                            <Image
                              src={officialArtwork}
                              alt={palette.pokemon.name}
                              fill
                              className="object-contain"
                              unoptimized
                            />
                          </div>
                        </div>
                      )}

                      {/* Pokemon Info */}
                      <div className="text-center space-y-1 mb-3">
                        <h3 className="font-bold text-base capitalize text-white drop-shadow-lg">
                          {palette.pokemon.name}
                        </h3>
                        <p className="text-xs text-white/90 drop-shadow-lg">
                          #{palette.pokemon.id.toString().padStart(3, "0")}
                        </p>
                      </div>

                      {/* Color Hex Codes */}
                      <div className="space-y-2 w-full">
                        <p className="text-xs font-semibold text-white/90 uppercase tracking-wide text-center drop-shadow-lg">
                          Colors
                        </p>
                        <div className="flex flex-wrap gap-1.5 justify-center">
                          {palette.colors.map((color, colorIndex) => (
                            <div
                              key={colorIndex}
                              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/30 backdrop-blur-sm border border-white/20"
                            >
                              <div
                                className="w-3 h-3 rounded border border-white/30"
                                style={{ backgroundColor: color }}
                              />
                              <span className="text-xs font-mono text-white drop-shadow-lg">
                                {color}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Link>
                )}
            </div>
          );
        })}
    </div>
  );
}

