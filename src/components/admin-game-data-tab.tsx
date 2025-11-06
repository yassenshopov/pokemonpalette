"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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

interface GameAttempt {
  id: string;
  user_id: string;
  date: string;
  target_pokemon_id: number;
  is_shiny: boolean;
  guesses: number[];
  attempts: number;
  won: boolean;
  pokemon_guessed: number | null;
  hints_used: number;
  created_at: string;
  users?: {
    id: string;
    email: string | null;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
  };
}

interface GameStats {
  totalAttempts: number;
  wins: number;
  losses: number;
  winRate: string;
  averageAttempts: string;
  averageHintsUsed: string;
}

type ViewMode = "daily-games" | "users";

export function AdminGameDataTab() {
  const [gameAttempts, setGameAttempts] = useState<GameAttempt[]>([]);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(25);
  const [showAll, setShowAll] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("daily-games");

  useEffect(() => {
    const fetchGameData = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/admin/game-data");

        if (!response.ok) {
          if (response.status === 403) {
            setError("Access denied. Admin privileges required.");
          } else if (response.status === 401) {
            setError("Unauthorized. Please sign in.");
          } else {
            setError("Failed to fetch game data");
          }
          return;
        }

        const data = await response.json();
        setGameAttempts(data.gameAttempts || []);
        setStats(data.stats || null);
      } catch (err) {
        console.error("Error fetching game data:", err);
        setError("Failed to load game data");
      } finally {
        setLoading(false);
      }
    };

    fetchGameData();
  }, []);

  const getUserDisplayName = useCallback((user: GameAttempt["users"]) => {
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
  }, []);

  // Group by daily games (by date)
  const groupedByDailyGames = useMemo(() => {
    const grouped = new Map<string, GameAttempt[]>();

    gameAttempts.forEach((attempt) => {
      const dateKey = attempt.date;
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(attempt);
    });

    // Convert to array and sort by date (newest first)
    return Array.from(grouped.entries())
      .map(([date, attempts]) => ({
        date,
        attempts: attempts.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [gameAttempts]);

  // Group by users
  const groupedByUsers = useMemo(() => {
    const grouped = new Map<
      string,
      { user: GameAttempt["users"]; attempts: GameAttempt[] }
    >();

    gameAttempts.forEach((attempt) => {
      const userId = attempt.user_id;
      if (!grouped.has(userId)) {
        grouped.set(userId, {
          user: attempt.users || undefined,
          attempts: [],
        });
      }
      grouped.get(userId)!.attempts.push(attempt);
    });

    // Convert to array and sort by user name
    return Array.from(grouped.values()).sort((a, b) => {
      const nameA = getUserDisplayName(a.user).toLowerCase();
      const nameB = getUserDisplayName(b.user).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [gameAttempts, getUserDisplayName]);

  const totalItems =
    viewMode === "daily-games"
      ? groupedByDailyGames.length
      : groupedByUsers.length;
  const effectivePageSize =
    showAll || pageSize === "all" ? totalItems : pageSize;
  const totalPages =
    effectivePageSize === totalItems
      ? 1
      : Math.ceil(totalItems / effectivePageSize);

  const displayedItems = useMemo(() => {
    const items =
      viewMode === "daily-games" ? groupedByDailyGames : groupedByUsers;
    if (showAll || pageSize === "all") {
      return items;
    }
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return items.slice(startIndex, endIndex);
  }, [
    viewMode,
    groupedByDailyGames,
    groupedByUsers,
    currentPage,
    pageSize,
    showAll,
  ]);

  useEffect(() => {
    if (!showAll && pageSize !== "all") {
      const maxPage = Math.ceil(totalItems / pageSize);
      if (currentPage > maxPage) {
        setCurrentPage(1);
      }
    }
  }, [pageSize, totalItems, showAll, currentPage, viewMode]);

  // Reset to first page when view mode changes
  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode]);

  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A";
    const d = typeof date === "string" ? new Date(date) : date;
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  };

  const formatDateTime = (date: Date | string | null) => {
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
        <div className="text-muted-foreground">Loading game data...</div>
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Attempts</CardDescription>
              <CardTitle className="text-3xl">{stats.totalAttempts}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Win Rate</CardDescription>
              <CardTitle className="text-3xl">{stats.winRate}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                {stats.wins} wins / {stats.losses} losses
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Average Attempts</CardDescription>
              <CardTitle className="text-3xl">
                {stats.averageAttempts}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Average Hints Used</CardDescription>
              <CardTitle className="text-3xl">
                {stats.averageHintsUsed}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Game Attempts</CardTitle>
              <CardDescription>
                Total {viewMode === "daily-games" ? "daily games" : "users"}:{" "}
                {totalItems}
                {!showAll && pageSize !== "all" && (
                  <>
                    {" "}
                    • Showing {displayedItems.length} of {totalItems} (Page{" "}
                    {currentPage} of {totalPages})
                  </>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">View:</span>
                <Select
                  value={viewMode}
                  onValueChange={(value) => setViewMode(value as ViewMode)}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily-games">By Daily Games</SelectItem>
                    <SelectItem value="users">By Users</SelectItem>
                  </SelectContent>
                </Select>
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
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {viewMode === "daily-games" ? (
                  <>
                    <TableHead>Game Date</TableHead>
                    <TableHead>Target Pokemon</TableHead>
                    <TableHead>Shiny</TableHead>
                    <TableHead>Players</TableHead>
                    <TableHead>Wins</TableHead>
                    <TableHead>Losses</TableHead>
                    <TableHead>Avg Attempts</TableHead>
                    <TableHead>Avg Hints</TableHead>
                    <TableHead>Guesses</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead>User</TableHead>
                    <TableHead>Total Games</TableHead>
                    <TableHead>Wins</TableHead>
                    <TableHead>Losses</TableHead>
                    <TableHead>Win Rate</TableHead>
                    <TableHead>Avg Attempts</TableHead>
                    <TableHead>Avg Hints</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedItems.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={viewMode === "daily-games" ? 9 : 7}
                    className="text-center text-muted-foreground"
                  >
                    No game attempts found
                  </TableCell>
                </TableRow>
              ) : viewMode === "daily-games" ? (
                (displayedItems as typeof groupedByDailyGames).map((group) => {
                  const wins = group.attempts.filter((a) => a.won).length;
                  const losses = group.attempts.length - wins;
                  const avgAttempts =
                    group.attempts.reduce((sum, a) => sum + a.attempts, 0) /
                    group.attempts.length;
                  const avgHints =
                    group.attempts.reduce(
                      (sum, a) => sum + (a.hints_used || 0),
                      0
                    ) / group.attempts.length;
                  const targetPokemonId = group.attempts[0]?.target_pokemon_id;
                  const isShiny = group.attempts[0]?.is_shiny || false;

                  // Group guesses by user
                  const guessesByUser = new Map<
                    string,
                    { user: GameAttempt["users"]; guesses: number[] }
                  >();

                  group.attempts.forEach((attempt) => {
                    const userId = attempt.user_id;
                    const userGuesses: number[] = [];

                    // Collect all guesses from this attempt
                    if (Array.isArray(attempt.guesses)) {
                      attempt.guesses.forEach((guess: number) => {
                        if (typeof guess === "number") {
                          userGuesses.push(guess);
                        }
                      });
                    }
                    if (attempt.pokemon_guessed) {
                      userGuesses.push(attempt.pokemon_guessed);
                    }

                    if (!guessesByUser.has(userId)) {
                      guessesByUser.set(userId, {
                        user: attempt.users || undefined,
                        guesses: [],
                      });
                    }

                    // Add unique guesses for this user
                    const existingGuesses = guessesByUser.get(userId)!.guesses;
                    userGuesses.forEach((guess) => {
                      if (!existingGuesses.includes(guess)) {
                        existingGuesses.push(guess);
                      }
                    });
                  });

                  const getOfficialArtworkUrl = (
                    pokemonId: number,
                    shiny: boolean = false
                  ): string => {
                    const shinyPath = shiny ? "/shiny" : "";
                    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork${shinyPath}/${pokemonId}.png`;
                  };

                  return (
                    <TableRow key={group.date}>
                      <TableCell className="font-medium">
                        {formatDate(group.date)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {targetPokemonId && (
                            <img
                              src={getOfficialArtworkUrl(
                                targetPokemonId,
                                isShiny
                              )}
                              alt={`Pokemon #${targetPokemonId}`}
                              className="w-10 h-10 object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          )}
                          <span className="text-sm">#{targetPokemonId}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            isShiny
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                          }`}
                        >
                          {isShiny ? "Yes" : "No"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {group.attempts.length}
                      </TableCell>
                      <TableCell className="text-sm text-green-600 dark:text-green-400">
                        {wins}
                      </TableCell>
                      <TableCell className="text-sm text-red-600 dark:text-red-400">
                        {losses}
                      </TableCell>
                      <TableCell className="text-sm">
                        {avgAttempts.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {avgHints.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2 max-w-[300px]">
                          {Array.from(guessesByUser.entries()).map(
                            ([userId, data]) => (
                              <div key={userId} className="flex flex-col gap-1">
                                <div className="text-xs font-medium text-muted-foreground truncate">
                                  {getUserDisplayName(data.user)}
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {data.guesses.slice(0, 8).map((pokemonId) => (
                                    <img
                                      key={pokemonId}
                                      src={getOfficialArtworkUrl(
                                        pokemonId,
                                        isShiny
                                      )}
                                      alt={`Pokemon #${pokemonId}`}
                                      className="w-7 h-7 object-contain"
                                      title={`#${pokemonId}`}
                                      onError={(e) => {
                                        (
                                          e.target as HTMLImageElement
                                        ).style.display = "none";
                                      }}
                                    />
                                  ))}
                                  {data.guesses.length > 8 && (
                                    <span className="text-xs text-muted-foreground flex items-center">
                                      +{data.guesses.length - 8}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                (displayedItems as typeof groupedByUsers).map((group) => {
                  const wins = group.attempts.filter((a) => a.won).length;
                  const losses = group.attempts.length - wins;
                  const winRate =
                    group.attempts.length > 0
                      ? ((wins / group.attempts.length) * 100).toFixed(1)
                      : "0";
                  const avgAttempts =
                    group.attempts.length > 0
                      ? group.attempts.reduce((sum, a) => sum + a.attempts, 0) /
                        group.attempts.length
                      : 0;
                  const avgHints =
                    group.attempts.length > 0
                      ? group.attempts.reduce(
                          (sum, a) => sum + (a.hints_used || 0),
                          0
                        ) / group.attempts.length
                      : 0;

                  return (
                    <TableRow key={group.user?.id || "unknown"}>
                      <TableCell>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-sm truncate">
                            {getUserDisplayName(group.user)}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            {group.user?.email || group.user?.id || "Unknown"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {group.attempts.length}
                      </TableCell>
                      <TableCell className="text-sm text-green-600 dark:text-green-400">
                        {wins}
                      </TableCell>
                      <TableCell className="text-sm text-red-600 dark:text-red-400">
                        {losses}
                      </TableCell>
                      <TableCell className="text-sm">{winRate}%</TableCell>
                      <TableCell className="text-sm">
                        {avgAttempts.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {avgHints.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {!showAll && pageSize !== "all" && totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * (pageSize as number) + 1} to{" "}
                {Math.min(currentPage * (pageSize as number), totalItems)} of{" "}
                {totalItems}{" "}
                {viewMode === "daily-games" ? "daily games" : "users"}
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
