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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";

interface SavedPalette {
  id: string;
  user_id: string;
  pokemon_id: number;
  pokemon_name: string;
  pokemon_form: string | null;
  is_shiny: boolean;
  colors: string[];
  image_url: string | null;
  palette_name: string | null;
  created_at: string;
  updated_at: string;
  users?: {
    id: string;
    email: string | null;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
  };
}

interface PaletteStats {
  totalPalettes: number;
  uniquePokemon: number;
  shinyCount: number;
  regularCount: number;
  topPokemon: Array<{ name: string; count: number; pokemon_id: number }>;
}

export function AdminSavedPalettesTab() {
  const [palettes, setPalettes] = useState<SavedPalette[]>([]);
  const [stats, setStats] = useState<PaletteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(25);
  const [showAll, setShowAll] = useState(false);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchPalettes = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/admin/saved-palettes");

        if (!response.ok) {
          if (response.status === 403) {
            setError("Access denied. Admin privileges required.");
          } else if (response.status === 401) {
            setError("Unauthorized. Please sign in.");
          } else {
            setError("Failed to fetch saved palettes");
          }
          return;
        }

        const data = await response.json();
        setPalettes(data.palettes || []);
        setStats(data.stats || null);
      } catch (err) {
        console.error("Error fetching saved palettes:", err);
        setError("Failed to load saved palettes");
      } finally {
        setLoading(false);
      }
    };

    fetchPalettes();
  }, []);

  const getUserDisplayName = (user: SavedPalette["users"]) => {
    if (!user) return "Unknown";
    if (user.first_name || user.last_name) {
      return `${user.first_name || ""} ${user.last_name || ""}`.trim();
    }
    if (user.username) {
      return user.username;
    }
    if (user.email) {
      return user.email.split("@")[0];
    }
    return "User";
  };

  // Group palettes by user
  const groupedByUser = useMemo(() => {
    const grouped = new Map<
      string,
      { user: SavedPalette["users"]; palettes: SavedPalette[] }
    >();

    palettes.forEach((palette) => {
      const userId = palette.user_id;
      if (!grouped.has(userId)) {
        grouped.set(userId, {
          user: palette.users,
          palettes: [],
        });
      }
      grouped.get(userId)!.palettes.push(palette);
    });

    // Convert to array and sort by most recently created palette (newest first)
    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        mostRecentDate: Math.max(
          ...group.palettes.map((p) => new Date(p.created_at).getTime())
        ),
      }))
      .sort((a, b) => b.mostRecentDate - a.mostRecentDate)
      .map(({ mostRecentDate, ...group }) => group);
  }, [palettes]);

  const totalUsers = groupedByUser.length;
  const effectivePageSize =
    showAll || pageSize === "all" ? totalUsers : pageSize;
  const totalPages =
    effectivePageSize === totalUsers
      ? 1
      : Math.ceil(totalUsers / effectivePageSize);

  const displayedGroups = useMemo(() => {
    if (showAll || pageSize === "all") {
      return groupedByUser;
    }
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return groupedByUser.slice(startIndex, endIndex);
  }, [groupedByUser, currentPage, pageSize, showAll]);

  useEffect(() => {
    if (!showAll && pageSize !== "all") {
      const maxPage = Math.ceil(totalUsers / pageSize);
      if (currentPage > maxPage) {
        setCurrentPage(1);
      }
    }
  }, [pageSize, totalUsers, showAll, currentPage]);

  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A";
    const d = typeof date === "string" ? new Date(date) : date;
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  };

  const handlePageSizeChange = (value: string) => {
    if (value === "all") {
      setPageSize("all");
      setShowAll(true);
      setCurrentPage(1);
    } else {
      setPageSize(Number(value));
      setShowAll(false);
      setCurrentPage(1);
    }
  };

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("ellipsis");
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push("ellipsis");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading saved palettes...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Palettes</CardDescription>
              <CardTitle className="text-3xl">{stats.totalPalettes}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Unique Pokemon</CardDescription>
              <CardTitle className="text-3xl">{stats.uniquePokemon}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Shiny Palettes</CardDescription>
              <CardTitle className="text-3xl">{stats.shinyCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                {stats.regularCount} regular
              </div>
            </CardContent>
          </Card>
          {stats.topPokemon[0] &&
            (() => {
              const topPokemon = stats.topPokemon[0];

              // Get representative color from saved palettes for this Pokemon
              const getPokemonColor = (pokemonId: number): string | null => {
                const pokemonPalettes = palettes.filter(
                  (p) =>
                    p.pokemon_id === pokemonId &&
                    Array.isArray(p.colors) &&
                    p.colors.length > 0
                );

                if (pokemonPalettes.length === 0) return null;

                // Get the first color from each palette (usually the primary color)
                const primaryColors = pokemonPalettes
                  .map((p) => p.colors[0])
                  .filter(
                    (color): color is string => typeof color === "string"
                  );

                if (primaryColors.length === 0) return null;

                // Return the most common color, or the first one if all are unique
                const colorCounts = primaryColors.reduce((acc, color) => {
                  acc[color] = (acc[color] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>);

                const mostCommonColor = Object.entries(colorCounts).sort(
                  ([, a], [, b]) => b - a
                )[0]?.[0];

                return mostCommonColor || primaryColors[0];
              };

              // Convert hex color to rgba with opacity
              const hexToRgba = (hex: string, opacity: number): string => {
                // Remove # if present
                const cleanHex = hex.replace("#", "");

                // Handle 3-digit hex
                const fullHex =
                  cleanHex.length === 3
                    ? cleanHex
                        .split("")
                        .map((c) => c + c)
                        .join("")
                    : cleanHex;

                const r = parseInt(fullHex.substring(0, 2), 16);
                const g = parseInt(fullHex.substring(2, 4), 16);
                const b = parseInt(fullHex.substring(4, 6), 16);

                return `rgba(${r}, ${g}, ${b}, ${opacity})`;
              };

              const pokemonColor = getPokemonColor(topPokemon.pokemon_id);
              const officialArtworkUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${topPokemon.pokemon_id}.png`;

              return (
                <Card
                  style={{
                    backgroundColor: pokemonColor
                      ? hexToRgba(pokemonColor, 0.1) // 10% opacity for card background
                      : undefined,
                    borderColor: pokemonColor
                      ? hexToRgba(pokemonColor, 0.3) // 30% opacity for border
                      : undefined,
                  }}
                >
                  <CardHeader className="pb-2">
                    <CardDescription>Top Saved Pokemon</CardDescription>
                    <div className="flex items-center gap-3 mt-2">
                      <img
                        src={officialArtworkUrl}
                        alt={topPokemon.name}
                        className="w-12 h-12 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <CardTitle className="text-lg capitalize">
                        {topPokemon.name}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">
                      {topPokemon.count} saves
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
        </div>
      )}

      {stats && stats.topPokemon.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Most Saved Pokemon</CardTitle>
            <CardDescription>
              Top 5 most frequently saved Pokemon
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.topPokemon.map((pokemon, index) => {
                // Generate official artwork URL
                const getOfficialArtworkUrl = (pokemonId: number): string => {
                  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonId}.png`;
                };

                // Convert hex color to rgba with opacity
                const hexToRgba = (hex: string, opacity: number): string => {
                  // Remove # if present
                  const cleanHex = hex.replace("#", "");

                  // Handle 3-digit hex
                  const fullHex =
                    cleanHex.length === 3
                      ? cleanHex
                          .split("")
                          .map((c) => c + c)
                          .join("")
                      : cleanHex;

                  const r = parseInt(fullHex.substring(0, 2), 16);
                  const g = parseInt(fullHex.substring(2, 4), 16);
                  const b = parseInt(fullHex.substring(4, 6), 16);

                  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
                };

                // Get representative color from saved palettes for this Pokemon
                const getPokemonColor = (pokemonId: number): string | null => {
                  const pokemonPalettes = palettes.filter(
                    (p) =>
                      p.pokemon_id === pokemonId &&
                      Array.isArray(p.colors) &&
                      p.colors.length > 0
                  );

                  if (pokemonPalettes.length === 0) return null;

                  // Get the first color from each palette (usually the primary color)
                  const primaryColors = pokemonPalettes
                    .map((p) => p.colors[0])
                    .filter(
                      (color): color is string => typeof color === "string"
                    );

                  if (primaryColors.length === 0) return null;

                  // Return the most common color, or the first one if all are unique
                  const colorCounts = primaryColors.reduce((acc, color) => {
                    acc[color] = (acc[color] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>);

                  const mostCommonColor = Object.entries(colorCounts).sort(
                    ([, a], [, b]) => b - a
                  )[0]?.[0];

                  return mostCommonColor || primaryColors[0];
                };

                const pokemonColor = getPokemonColor(pokemon.pokemon_id);

                return (
                  <div
                    key={pokemon.name}
                    className="flex items-center justify-between p-2 rounded-md transition-colors"
                    style={{
                      backgroundColor: pokemonColor
                        ? hexToRgba(pokemonColor, 0.08) // 8% opacity for faint tint
                        : undefined,
                      borderColor: pokemonColor
                        ? hexToRgba(pokemonColor, 0.2) // 20% opacity for border
                        : undefined,
                      borderWidth: pokemonColor ? "1px" : undefined,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium w-6">
                        #{index + 1}
                      </span>
                      <img
                        src={getOfficialArtworkUrl(pokemon.pokemon_id)}
                        alt={pokemon.name}
                        className="w-12 h-12 object-contain"
                        onError={(e) => {
                          // Fallback if artwork fails to load
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <span className="text-sm font-medium capitalize">
                        {pokemon.name}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {pokemon.count} saves
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Saved Palettes</CardTitle>
              <CardDescription>
                Total users: {totalUsers} • Total palettes: {palettes.length}
                {!showAll && pageSize !== "all" && (
                  <>
                    {" "}
                    • Showing {displayedGroups.length} of {totalUsers} users
                    (Page {currentPage} of {totalPages})
                  </>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Show:</span>
              <Select
                value={showAll ? "all" : String(pageSize)}
                onValueChange={handlePageSizeChange}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 per page</SelectItem>
                  <SelectItem value="25">25 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                  <SelectItem value="100">100 per page</SelectItem>
                  <SelectItem value="all">Show all</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Sprite</TableHead>
                <TableHead>Pokemon</TableHead>
                <TableHead>Form</TableHead>
                <TableHead>Shiny</TableHead>
                <TableHead>Colors</TableHead>
                <TableHead>Palette Name</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedGroups.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-muted-foreground"
                  >
                    No saved palettes found
                  </TableCell>
                </TableRow>
              ) : (
                displayedGroups.map((group, groupIndex) => {
                  const userId = group.user?.id || `unknown-${groupIndex}`;
                  const isExpanded = expandedUsers.has(userId);

                  const toggleExpand = () => {
                    setExpandedUsers((prev) => {
                      const newSet = new Set(prev);
                      if (newSet.has(userId)) {
                        newSet.delete(userId);
                      } else {
                        newSet.add(userId);
                      }
                      return newSet;
                    });
                  };

                  const getOfficialArtworkUrl = (
                    pokemonId: number,
                    isShiny: boolean = false
                  ): string => {
                    const shinyPath = isShiny ? "/shiny" : "";
                    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork${shinyPath}/${pokemonId}.png`;
                  };

                  if (!isExpanded) {
                    // Collapsed view - show only user info and artwork grid
                    return (
                      <TableRow
                        key={userId}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={toggleExpand}
                      >
                        <TableCell colSpan={8} className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="font-medium text-sm truncate">
                                {getUserDisplayName(group.user)}
                              </span>
                              <span className="text-xs text-muted-foreground truncate">
                                {group.user?.email ||
                                  group.user?.id ||
                                  "Unknown"}
                              </span>
                              <span className="text-xs text-muted-foreground mt-1">
                                {group.palettes.length} palette
                                {group.palettes.length !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <div className="grid grid-cols-8 gap-2 ml-4 max-w-fit">
                              {group.palettes.map((palette) => (
                                <img
                                  key={palette.id}
                                  src={
                                    palette.image_url ||
                                    getOfficialArtworkUrl(
                                      palette.pokemon_id,
                                      palette.is_shiny
                                    )
                                  }
                                  alt={palette.pokemon_name}
                                  className="w-12 h-12 object-contain"
                                  title={`${palette.pokemon_name}${
                                    palette.is_shiny ? " (Shiny)" : ""
                                  }`}
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = getOfficialArtworkUrl(
                                      palette.pokemon_id,
                                      palette.is_shiny
                                    );
                                  }}
                                />
                              ))}
                            </div>
                            <div className="ml-4 text-muted-foreground">
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }

                  // Expanded view - show full table rows
                  return group.palettes.map((palette, paletteIndex) => (
                    <TableRow key={palette.id}>
                      {paletteIndex === 0 && (
                        <TableCell
                          rowSpan={group.palettes.length}
                          className="align-top border-r border-border/50"
                        >
                          <div className="flex flex-col min-w-0 py-2">
                            <button
                              onClick={toggleExpand}
                              className="flex items-center gap-1 text-left hover:underline"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 15l7-7 7 7"
                                />
                              </svg>
                              <span className="font-medium text-sm truncate">
                                {getUserDisplayName(group.user)}
                              </span>
                            </button>
                            <span className="text-xs text-muted-foreground truncate">
                              {group.user?.email || group.user?.id || "Unknown"}
                            </span>
                            <span className="text-xs text-muted-foreground mt-1">
                              {group.palettes.length} palette
                              {group.palettes.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        {palette.image_url ? (
                          <img
                            src={palette.image_url}
                            alt={palette.pokemon_name}
                            className="w-12 h-12 object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 flex items-center justify-center bg-muted rounded text-xs text-muted-foreground">
                            N/A
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium capitalize">
                            {palette.pokemon_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            #{palette.pokemon_id}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {palette.pokemon_form || "N/A"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            palette.is_shiny
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                          }`}
                        >
                          {palette.is_shiny ? "Yes" : "No"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {Array.isArray(palette.colors) &&
                            palette.colors
                              .slice(0, 5)
                              .map((color, idx) => (
                                <div
                                  key={idx}
                                  className="w-6 h-6 rounded border border-border"
                                  style={{ backgroundColor: color }}
                                  title={color}
                                />
                              ))}
                          {Array.isArray(palette.colors) &&
                            palette.colors.length > 5 && (
                              <span className="text-xs text-muted-foreground flex items-center">
                                +{palette.colors.length - 5}
                              </span>
                            )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {palette.palette_name || "N/A"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(palette.created_at)}
                      </TableCell>
                    </TableRow>
                  ));
                })
              )}
            </TableBody>
          </Table>

          {!showAll && pageSize !== "all" && totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * (pageSize as number) + 1} to{" "}
                {Math.min(currentPage * (pageSize as number), totalUsers)} of{" "}
                {totalUsers} users
              </div>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage > 1) {
                          setCurrentPage((prev) => prev - 1);
                        }
                      }}
                      className={
                        currentPage === 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>

                  {getPageNumbers().map((page, index) => (
                    <PaginationItem key={index}>
                      {page === "ellipsis" ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage(page);
                          }}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage < totalPages) {
                          setCurrentPage((prev) => prev + 1);
                        }
                      }}
                      className={
                        currentPage === totalPages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
