"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { X, Sparkles, Loader2, Bookmark, Search, Filter } from "lucide-react";
import Image from "next/image";
import { getPokemonById } from "@/lib/pokemon";
import { gsap } from "gsap";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Helper function to determine if text should be dark or light based on background
const getTextColor = (hex: string): "#ffffff" | "#000000" => {
  const hexClean = hex.replace("#", "");
  const r = parseInt(hexClean.substring(0, 2), 16);
  const g = parseInt(hexClean.substring(2, 4), 16);
  const b = parseInt(hexClean.substring(4, 6), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return white for dark colors, black for light colors
  return luminance > 0.5 ? "#000000" : "#ffffff";
};

interface SavedPalette {
  id: string;
  pokemon_id: number;
  pokemon_name: string;
  pokemon_form?: string;
  is_shiny: boolean;
  colors: string[];
  image_url?: string;
  palette_name?: string;
  created_at: string;
}

interface SavedPalettesDialogProps {
  onPaletteSelect?: (palette: {
    pokemonId: number;
    isShiny: boolean;
    colors: string[];
  }) => void;
  trigger?: React.ReactNode;
  isCollapsed?: boolean;
}

export function SavedPalettesDialog({
  onPaletteSelect,
  trigger,
  isCollapsed = false,
}: SavedPalettesDialogProps) {
  const [open, setOpen] = useState(false);
  const [palettes, setPalettes] = useState<SavedPalette[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterShiny, setFilterShiny] = useState<boolean | null>(null);
  const [pokemonSprites, setPokemonSprites] = useState<
    Record<number, { normal: string | null; shiny: string | null }>
  >({});
  const loadingIdsRef = useRef<Set<number>>(new Set());
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const { user, isLoaded } = useUser();

  // Fetch saved palettes when dialog opens
  useEffect(() => {
    if (open && user) {
      fetchPalettes();
    }
  }, [open, user]);

  const fetchPalettes = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/saved-palettes");
      const data = await response.json();

      if (response.ok) {
        setPalettes(data.palettes || []);
      } else if (response.status === 503) {
        toast.error(
          "Authentication service is currently unavailable. Please try again later."
        );
      } else if (response.status === 401) {
        toast.error("Please sign in to view saved palettes");
      } else {
        toast.error(data.error || "Failed to fetch saved palettes");
      }
    } catch (error) {
      console.error("Error fetching palettes:", error);
      toast.error("Failed to fetch saved palettes");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePalette = async (paletteId: string) => {
    setDeletingId(paletteId);
    try {
      const response = await fetch(`/api/saved-palettes/${paletteId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (response.ok) {
        setPalettes(palettes.filter((p) => p.id !== paletteId));
        toast.success("Palette deleted successfully");
      } else if (response.status === 503) {
        toast.error(
          "Authentication service is currently unavailable. Please try again later."
        );
      } else if (response.status === 401) {
        toast.error("Please sign in to delete palettes");
      } else {
        toast.error(result.error || "Failed to delete palette");
      }
    } catch (error) {
      console.error("Error deleting palette:", error);
      toast.error("Failed to delete palette");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSelectPalette = (palette: SavedPalette) => {
    onPaletteSelect?.({
      pokemonId: palette.pokemon_id,
      isShiny: palette.is_shiny,
      colors: palette.colors,
    });
    setOpen(false);
    toast.success(`Loaded ${palette.pokemon_name} palette`);
  };

  // Load sprites for palettes
  useEffect(() => {
    const loadSprite = async (id: number) => {
      // Skip if already loaded or currently loading
      setPokemonSprites((prev) => {
        if (prev[id] || loadingIdsRef.current.has(id)) {
          return prev;
        }

        loadingIdsRef.current.add(id);

        // Load sprite asynchronously
        getPokemonById(id)
          .then((pokemon) => {
            if (
              pokemon &&
              typeof pokemon.artwork === "object" &&
              "front" in pokemon.artwork
            ) {
              const normal = pokemon.artwork.front || null;
              const shiny =
                "shiny" in pokemon.artwork && pokemon.artwork.shiny
                  ? pokemon.artwork.shiny
                  : null;
              setPokemonSprites((prev) => ({
                ...prev,
                [id]: { normal, shiny },
              }));
            }
            loadingIdsRef.current.delete(id);
          })
          .catch((error) => {
            console.error(`Failed to load sprite for Pokemon ${id}:`, error);
            loadingIdsRef.current.delete(id);
          });

        return prev;
      });
    };

    // Load sprites for all palettes
    palettes.forEach((palette) => {
      loadSprite(palette.pokemon_id);
    });
  }, [palettes]);

  // Filter and search palettes
  const filteredPalettes = useMemo(() => {
    return palettes.filter((palette) => {
      // Search filter - by name or hex code
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const nameMatch = palette.pokemon_name.toLowerCase().includes(query);
        const hexMatch = palette.colors.some((color) =>
          color.toLowerCase().includes(query)
        );
        if (!nameMatch && !hexMatch) {
          return false;
        }
      }

      // Shiny filter
      if (filterShiny !== null && palette.is_shiny !== filterShiny) {
        return false;
      }

      return true;
    });
  }, [palettes, searchQuery, filterShiny]);

  // Group palettes by date (for palettes older than 1 day)
  const groupedPalettes = useMemo(() => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recent: SavedPalette[] = [];
    const grouped: Record<string, SavedPalette[]> = {};
    const dateMap: Record<string, Date> = {}; // Store Date objects for sorting

    filteredPalettes.forEach((palette) => {
      const createdDate = new Date(palette.created_at);
      const isRecent = createdDate > oneDayAgo;

      if (isRecent) {
        recent.push(palette);
      } else {
        // Group by date (formatted string for display)
        const dateKey = createdDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
          // Store the Date object for sorting (normalize to start of day)
          const normalizedDate = new Date(createdDate);
          normalizedDate.setHours(0, 0, 0, 0);
          dateMap[dateKey] = normalizedDate;
        }
        grouped[dateKey].push(palette);
      }
    });

    // Sort grouped dates in descending order (newest first) using stored Date objects
    const sortedGroupKeys = Object.keys(grouped).sort((a, b) => {
      return dateMap[b].getTime() - dateMap[a].getTime();
    });

    return { recent, grouped, sortedGroupKeys };
  }, [filteredPalettes]);

  // Animate palette cards when they change (filter/search)
  useEffect(() => {
    const cards = cardsRef.current.filter(Boolean);
    if (cards.length === 0) return;

    // Reset cards to initial state
    gsap.set(cards, {
      opacity: 0,
      y: 20,
      scale: 0.95,
    });

    // Animate cards in with stagger
    gsap.to(cards, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.4,
      stagger: 0.03,
      ease: "power2.out",
    });
  }, [groupedPalettes]);

  // Animate dialog content when it opens
  useEffect(() => {
    if (open && dialogContentRef.current) {
      gsap.fromTo(
        dialogContentRef.current,
        {
          opacity: 0,
          scale: 0.95,
        },
        {
          opacity: 1,
          scale: 1,
          duration: 0.3,
          ease: "power2.out",
        }
      );
    }
  }, [open]);

  if (!isLoaded) {
    return null;
  }

  if (!user) {
    // In collapsed mode, show just an icon with tooltip
    if (isCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled
              className="p-2 rounded-lg cursor-not-allowed opacity-50"
            >
              <Bookmark className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Sign in to view saved palettes</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    // In expanded mode, show full button with text
    return (
      <Button
        variant="outline"
        disabled
        className="flex items-center gap-2 cursor-not-allowed"
      >
        <Bookmark className="w-4 h-4" />
        Sign in to view saved palettes
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            className="flex items-center gap-2 cursor-pointer"
          >
            <Bookmark className="w-4 h-4" />
            Saved Palettes
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="!max-w-3xl w-[75vw] max-h-[80vh] sm:!max-w-3xl"
        ref={dialogContentRef}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bookmark className="w-5 h-5" />
            Your Saved Palettes
          </DialogTitle>
          <DialogDescription>
            Select a saved palette to load it, or delete palettes you no longer
            need.
          </DialogDescription>
        </DialogHeader>

        {/* Search and Filter */}
        <div className="space-y-4 pb-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search by name or hex code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Filter by Type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={filterShiny === true}
                  onCheckedChange={(checked) =>
                    setFilterShiny(checked ? true : null)
                  }
                >
                  Shiny
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={filterShiny === false}
                  onCheckedChange={(checked) =>
                    setFilterShiny(checked ? false : null)
                  }
                >
                  Normal
                </DropdownMenuCheckboxItem>
                {(filterShiny !== null || searchQuery.trim()) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={false}
                      onCheckedChange={() => {
                        setFilterShiny(null);
                        setSearchQuery("");
                      }}
                    >
                      Clear filters
                    </DropdownMenuCheckboxItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <ScrollArea className="max-h-[calc(80vh-180px)]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="ml-2">Loading your saved palettes...</span>
            </div>
          ) : palettes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bookmark className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No saved palettes yet</p>
              <p className="text-sm">
                Save your first palette by clicking the &quot;Save Palette&quot;
                button when viewing a Pokémon!
              </p>
            </div>
          ) : filteredPalettes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Filter className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">
                No palettes match your filters
              </p>
              <p className="text-sm">
                Try adjusting your search or filter criteria.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Recent palettes (less than 1 day old) */}
              {groupedPalettes.recent.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1">
                    Recent
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupedPalettes.recent.map((palette, index) => {
                      const spriteData = pokemonSprites[palette.pokemon_id];
                      const spriteUrl = palette.is_shiny
                        ? spriteData?.shiny || spriteData?.normal || null
                        : spriteData?.normal || null;

                      return (
                        <Card
                          key={palette.id}
                          ref={(el) => {
                            cardsRef.current[index] = el;
                          }}
                          className="cursor-pointer hover:scale-105 transition-transform overflow-hidden pb-0 relative shadow-none"
                          onClick={() => handleSelectPalette(palette)}
                        >
                          {/* Delete button - top right */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteDialogOpen(palette.id);
                            }}
                            disabled={deletingId === palette.id}
                            className="absolute top-2 right-2 z-10 h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                          >
                            {deletingId === palette.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <X className="w-4 h-4" />
                            )}
                          </Button>

                          <CardContent className="p-4 pb-0">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                {spriteUrl && (
                                  <div className="w-12 h-12 relative">
                                    <Image
                                      src={spriteUrl}
                                      alt={palette.pokemon_name}
                                      width={48}
                                      height={48}
                                      className="w-full h-full object-contain"
                                      style={{ imageRendering: "pixelated" }}
                                      unoptimized
                                    />
                                  </div>
                                )}
                                <div>
                                  <h3 className="font-semibold capitalize flex items-center gap-2">
                                    {palette.pokemon_name}
                                    {palette.is_shiny && (
                                      <Sparkles className="w-4 h-4 text-yellow-500" />
                                    )}
                                  </h3>
                                  <p className="text-sm text-muted-foreground">
                                    #
                                    {palette.pokemon_id
                                      .toString()
                                      .padStart(3, "0")}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </CardContent>

                          {/* Color palette preview - vertical stripes at bottom */}
                          <div className="flex h-12 w-full">
                            {palette.colors.map((color, index) => (
                              <div
                                key={index}
                                className="flex-1"
                                style={{ backgroundColor: color }}
                                title={color}
                              />
                            ))}
                          </div>

                          {/* Delete confirmation dialog */}
                          <AlertDialog
                            open={deleteDialogOpen === palette.id}
                            onOpenChange={(open) => {
                              if (!open) {
                                setDeleteDialogOpen(null);
                              }
                            }}
                          >
                            <AlertDialogContent
                              onClick={(e) => e.stopPropagation()}
                            >
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete Palette?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete the{" "}
                                  {palette.pokemon_name} palette? This action
                                  cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeletePalette(palette.id);
                                    setDeleteDialogOpen(null);
                                  }}
                                  style={{
                                    backgroundColor:
                                      palette.colors[0] || "#6366f1",
                                    color: getTextColor(
                                      palette.colors[0] || "#6366f1"
                                    ),
                                  }}
                                  className="hover:opacity-90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Grouped palettes by date (older than 1 day) */}
              {groupedPalettes.sortedGroupKeys.map((dateKey, groupIndex) => {
                const groupPalettes = groupedPalettes.grouped[dateKey];
                const startIndex =
                  groupedPalettes.recent.length +
                  groupedPalettes.sortedGroupKeys
                    .slice(0, groupIndex)
                    .reduce(
                      (sum, key) => sum + groupedPalettes.grouped[key].length,
                      0
                    );

                return (
                  <div key={dateKey}>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1">
                      {dateKey}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {groupPalettes.map((palette, index) => {
                        const spriteData = pokemonSprites[palette.pokemon_id];
                        const spriteUrl = palette.is_shiny
                          ? spriteData?.shiny || spriteData?.normal || null
                          : spriteData?.normal || null;
                        const cardIndex = startIndex + index;

                        return (
                          <Card
                            key={palette.id}
                            ref={(el) => {
                              cardsRef.current[cardIndex] = el;
                            }}
                            className="cursor-pointer hover:scale-105 transition-transform overflow-hidden pb-0 relative shadow-none"
                            onClick={() => handleSelectPalette(palette)}
                          >
                            {/* Delete button - top right */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteDialogOpen(palette.id);
                              }}
                              disabled={deletingId === palette.id}
                              className="absolute top-2 right-2 z-10 h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                            >
                              {deletingId === palette.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <X className="w-4 h-4" />
                              )}
                            </Button>

                            <CardContent className="p-4 pb-0">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  {spriteUrl && (
                                    <div className="w-12 h-12 relative">
                                      <Image
                                        src={spriteUrl}
                                        alt={palette.pokemon_name}
                                        width={48}
                                        height={48}
                                        className="w-full h-full object-contain"
                                        style={{ imageRendering: "pixelated" }}
                                        unoptimized
                                      />
                                    </div>
                                  )}
                                  <div>
                                    <h3 className="font-semibold capitalize flex items-center gap-2">
                                      {palette.pokemon_name}
                                      {palette.is_shiny && (
                                        <Sparkles className="w-4 h-4 text-yellow-500" />
                                      )}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                      #
                                      {palette.pokemon_id
                                        .toString()
                                        .padStart(3, "0")}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </CardContent>

                            {/* Color palette preview - vertical stripes at bottom */}
                            <div className="flex h-12 w-full">
                              {palette.colors.map((color, index) => (
                                <div
                                  key={index}
                                  className="flex-1"
                                  style={{ backgroundColor: color }}
                                  title={color}
                                />
                              ))}
                            </div>

                            {/* Delete confirmation dialog */}
                            <AlertDialog
                              open={deleteDialogOpen === palette.id}
                              onOpenChange={(open) => {
                                if (!open) {
                                  setDeleteDialogOpen(null);
                                }
                              }}
                            >
                              <AlertDialogContent
                                onClick={(e) => e.stopPropagation()}
                              >
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete Palette?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete the{" "}
                                    {palette.pokemon_name} palette? This action
                                    cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeletePalette(palette.id);
                                      setDeleteDialogOpen(null);
                                    }}
                                    style={{
                                      backgroundColor:
                                        palette.colors[0] || "#6366f1",
                                      color: getTextColor(
                                        palette.colors[0] || "#6366f1"
                                      ),
                                    }}
                                    className="hover:opacity-90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
