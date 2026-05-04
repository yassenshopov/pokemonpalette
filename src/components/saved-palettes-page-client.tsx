"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useUser, SignInButton } from "@clerk/nextjs";
import { gsap } from "gsap";
import { toast } from "sonner";
import {
  Bookmark,
  Filter,
  Loader2,
  LogIn,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
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
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { Footer } from "@/components/footer";

import { getPokemonById } from "@/lib/pokemon";
import { getContrastHex as getTextColor } from "@/lib/game/colors";
import { useSavedPalettes } from "@/hooks/use-saved-palettes";

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

function buildPaletteHref(palette: SavedPalette): string {
  const slug = palette.pokemon_name.toLowerCase();
  return palette.is_shiny ? `/shiny/${slug}` : `/${slug}`;
}

export function SavedPalettesPageClient() {
  const { user, isLoaded } = useUser();
  const {
    palettes: rawPalettes,
    loading,
    refetch: refetchPalettes,
    mutate: mutatePalettes,
  } = useSavedPalettes();
  const palettes = rawPalettes as unknown as SavedPalette[];

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterShiny, setFilterShiny] = useState<boolean | null>(null);
  const [pokemonSprites, setPokemonSprites] = useState<
    Record<number, { normal: string | null; shiny: string | null }>
  >({});
  const loadingIdsRef = useRef<Set<number>>(new Set());
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  // Refresh once we know who's signed in, in case other surfaces saved
  // palettes after the cache was warmed.
  useEffect(() => {
    if (user) {
      refetchPalettes();
    }
  }, [user, refetchPalettes]);

  const handleDeletePalette = async (paletteId: string) => {
    setDeletingId(paletteId);
    try {
      const response = await fetch(`/api/saved-palettes/${paletteId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (response.ok) {
        mutatePalettes((prev) => prev.filter((p) => p.id !== paletteId));
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

  // Lazily fetch artwork for each unique Pokémon represented in the saved
  // palettes so we can render proper sprites in the cards.
  useEffect(() => {
    const loadSprite = async (id: number) => {
      setPokemonSprites((prev) => {
        if (prev[id] || loadingIdsRef.current.has(id)) {
          return prev;
        }

        loadingIdsRef.current.add(id);

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

    palettes.forEach((palette) => {
      loadSprite(palette.pokemon_id);
    });
  }, [palettes]);

  const filteredPalettes = useMemo(() => {
    return palettes.filter((palette) => {
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

      if (filterShiny !== null && palette.is_shiny !== filterShiny) {
        return false;
      }

      return true;
    });
  }, [palettes, searchQuery, filterShiny]);

  const groupedPalettes = useMemo(() => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recent: SavedPalette[] = [];
    const grouped: Record<string, SavedPalette[]> = {};
    const dateMap: Record<string, Date> = {};

    filteredPalettes.forEach((palette) => {
      const createdDate = new Date(palette.created_at);
      const isRecent = createdDate > oneDayAgo;

      if (isRecent) {
        recent.push(palette);
      } else {
        const dateKey = createdDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
          const normalizedDate = new Date(createdDate);
          normalizedDate.setHours(0, 0, 0, 0);
          dateMap[dateKey] = normalizedDate;
        }
        grouped[dateKey].push(palette);
      }
    });

    const sortedGroupKeys = Object.keys(grouped).sort((a, b) => {
      return dateMap[b].getTime() - dateMap[a].getTime();
    });

    return { recent, grouped, sortedGroupKeys };
  }, [filteredPalettes]);

  // Stagger-in animation whenever the rendered set changes.
  useEffect(() => {
    const cards = cardsRef.current.filter(Boolean);
    if (cards.length === 0) return;

    gsap.set(cards, {
      opacity: 0,
      y: 20,
      scale: 0.95,
    });

    gsap.to(cards, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.4,
      stagger: 0.03,
      ease: "power2.out",
    });
  }, [groupedPalettes]);

  const totalPalettes = palettes.length;
  const accentColor = palettes[0]?.colors?.[0];

  const renderPaletteCard = (palette: SavedPalette, cardIndex: number) => {
    const spriteData = pokemonSprites[palette.pokemon_id];
    const spriteUrl = palette.is_shiny
      ? spriteData?.shiny || spriteData?.normal || null
      : spriteData?.normal || null;
    const href = buildPaletteHref(palette);

    return (
      <Card
        key={palette.id}
        ref={(el) => {
          cardsRef.current[cardIndex] = el;
        }}
        className="group cursor-pointer hover:scale-[1.02] transition-transform overflow-hidden pb-0 relative shadow-none"
      >
        <Link
          href={href}
          aria-label={`Open ${palette.pokemon_name}${
            palette.is_shiny ? " (shiny)" : ""
          }`}
          className="absolute inset-0 z-0"
        />

        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDeleteDialogOpen(palette.id);
          }}
          disabled={deletingId === palette.id}
          aria-label={`Delete ${palette.pokemon_name} palette`}
          className="absolute top-2 right-2 z-10 h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
        >
          {deletingId === palette.id ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <X className="w-4 h-4" />
          )}
        </Button>

        <CardContent className="relative z-[1] p-4 pb-0 pointer-events-none">
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
                  #{palette.pokemon_id.toString().padStart(3, "0")}
                </p>
              </div>
            </div>
          </div>
        </CardContent>

        <div className="relative z-[1] flex h-12 w-full pointer-events-none">
          {palette.colors.map((color, index) => (
            <div
              key={index}
              className="flex-1"
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>

        <AlertDialog
          open={deleteDialogOpen === palette.id}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteDialogOpen(null);
            }
          }}
        >
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Palette?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the {palette.pokemon_name}{" "}
                palette? This action cannot be undone.
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
                  backgroundColor: palette.colors[0] || "#6366f1",
                  color: getTextColor(palette.colors[0] || "#6366f1"),
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
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <CollapsibleSidebar primaryColor={accentColor} />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
          <div className="container mx-auto px-4 md:px-6 py-4 md:py-6">
            <div className="flex items-center gap-2">
              <Bookmark className="w-6 h-6 text-primary" />
              <h1 className="text-2xl md:text-3xl font-bold">
                Saved Palettes
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {user && totalPalettes > 0
                ? `You have ${totalPalettes} saved palette${
                    totalPalettes === 1 ? "" : "s"
                  }. Click any palette to open its Pokémon page.`
                : "View, search, and manage every palette you've saved."}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="container mx-auto px-4 md:px-6 py-6 md:py-8">
            {!isLoaded ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !user ? (
              <div className="max-w-md mx-auto text-center py-16 text-muted-foreground">
                <Bookmark className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2 text-foreground">
                  Sign in to view your saved palettes
                </p>
                <p className="text-sm mb-6">
                  Save palettes from any Pokémon and they&apos;ll show up here
                  across all your devices.
                </p>
                <SignInButton mode="modal">
                  <Button className="cursor-pointer">
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign in
                  </Button>
                </SignInButton>
              </div>
            ) : (
              <>
                {/* Search and filter */}
                <div className="flex items-center gap-2 mb-6">
                  <div className="relative flex-1 max-w-xl">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4"
                      aria-hidden="true"
                    />
                    <Input
                      placeholder="Search by name or hex code..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      aria-label="Search saved palettes by name or hex code"
                      type="search"
                    />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex items-center gap-2"
                      >
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

                {loading && palettes.length === 0 ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">
                      Loading your saved palettes...
                    </span>
                  </div>
                ) : palettes.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Bookmark className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2 text-foreground">
                      No saved palettes yet
                    </p>
                    <p className="text-sm mb-6">
                      Save your first palette by clicking the &quot;Save
                      Palette&quot; button when viewing a Pokémon.
                    </p>
                    <Link href="/explore">
                      <Button variant="outline" className="cursor-pointer">
                        Explore palettes
                      </Button>
                    </Link>
                  </div>
                ) : filteredPalettes.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Filter className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2 text-foreground">
                      No palettes match your filters
                    </p>
                    <p className="text-sm">
                      Try adjusting your search or filter criteria.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {groupedPalettes.recent.length > 0 && (
                      <div>
                        <h2 className="text-sm font-semibold text-muted-foreground mb-3 px-1">
                          Recent
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {groupedPalettes.recent.map((palette, index) =>
                            renderPaletteCard(palette, index)
                          )}
                        </div>
                      </div>
                    )}

                    {groupedPalettes.sortedGroupKeys.map(
                      (dateKey, groupIndex) => {
                        const groupPalettes = groupedPalettes.grouped[dateKey];
                        const startIndex =
                          groupedPalettes.recent.length +
                          groupedPalettes.sortedGroupKeys
                            .slice(0, groupIndex)
                            .reduce(
                              (sum, key) =>
                                sum + groupedPalettes.grouped[key].length,
                              0
                            );

                        return (
                          <div key={dateKey}>
                            <h2 className="text-sm font-semibold text-muted-foreground mb-3 px-1">
                              {dateKey}
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                              {groupPalettes.map((palette, index) =>
                                renderPaletteCard(palette, startIndex + index)
                              )}
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          <Footer />
        </div>
      </div>
    </div>
  );
}
