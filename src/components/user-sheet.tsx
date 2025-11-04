"use client";

import { useState, useEffect, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getPokemonMetadataById, getPokemonById } from "@/lib/pokemon";
import { ScrollArea } from "@/components/ui/scroll-area";
import Image from "next/image";
import { Sparkles } from "lucide-react";

interface User {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  image_url: string | null;
  profile_image_url: string | null;
  banned: boolean;
  locked: boolean;
  two_factor_enabled: boolean;
  totp_enabled: boolean;
  last_active_at: string | null;
  last_sign_in_at: string | null;
  created_at: string;
}

interface GameAttempt {
  id: string;
  date: string;
  target_pokemon_id: number;
  is_shiny: boolean;
  guesses: number[];
  attempts: number;
  won: boolean;
  pokemon_guessed: number | null;
  hints_used: number;
  created_at: string;
}

interface SavedPalette {
  id: string;
  pokemon_id: number;
  pokemon_name: string;
  pokemon_form: string | null;
  is_shiny: boolean;
  colors: string[];
  image_url: string | null;
  palette_name: string | null;
  created_at: string;
}

interface GameStats {
  totalGames: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  averageAttempts: number;
}

interface UserSheetProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserSheet({ user, open, onOpenChange }: UserSheetProps) {
  const [gameAttempts, setGameAttempts] = useState<GameAttempt[]>([]);
  const [savedPalettes, setSavedPalettes] = useState<SavedPalette[]>([]);
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [pokemonSprites, setPokemonSprites] = useState<
    Record<number, { normal: string | null; shiny: string | null }>
  >({});
  const loadingIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (open && user) {
      fetchUserData();
    }
  }, [open, user?.id]);

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
    savedPalettes.forEach((palette) => {
      loadSprite(palette.pokemon_id);
    });
  }, [savedPalettes]);

  const fetchUserData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`);
      if (!response.ok) {
        console.error("Failed to fetch user data");
        return;
      }

      const data = await response.json();
      setGameAttempts(data.gameAttempts || []);
      setSavedPalettes(data.savedPalettes || []);
      setGameStats(data.gameStats || null);
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getUserDisplayName = (user: User) => {
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

  const getUserInitials = (user: User) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`.toUpperCase() || "U";
    }
    if (user.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    if (user.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  const formatDate = (date: string | null) => {
    if (!date) return "N/A";
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  if (!user) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-6">
        <SheetHeader className="pb-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage
                src={user.image_url || user.profile_image_url || undefined}
                alt={getUserDisplayName(user)}
              />
              <AvatarFallback className="text-lg">
                {getUserInitials(user)}
              </AvatarFallback>
            </Avatar>
            <div>
              <SheetTitle>{getUserDisplayName(user)}</SheetTitle>
              <SheetDescription>
                {user.email || "No email"}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-8 space-y-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="games">Games</TabsTrigger>
              <TabsTrigger value="palettes">Palettes</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>User Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">User ID</p>
                      <p className="text-sm font-mono">{user.id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Username</p>
                      <p className="text-sm">{user.username || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="text-sm">{user.email || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="text-sm">
                        {user.first_name || user.last_name
                          ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Created</p>
                      <p className="text-sm">{formatDate(user.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Last Active</p>
                      <p className="text-sm">{formatDate(user.last_active_at)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Last Sign In</p>
                      <p className="text-sm">{formatDate(user.last_sign_in_at)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {user.banned && (
                      <Badge variant="destructive">Banned</Badge>
                    )}
                    {user.locked && (
                      <Badge variant="destructive">Locked</Badge>
                    )}
                    {(user.two_factor_enabled || user.totp_enabled) && (
                      <Badge variant="secondary">2FA Enabled</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {gameStats && (
                <Card>
                  <CardHeader>
                    <CardTitle>Game Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Games</p>
                        <p className="text-2xl font-bold">{gameStats.totalGames}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Wins</p>
                        <p className="text-2xl font-bold text-green-600">{gameStats.totalWins}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Losses</p>
                        <p className="text-2xl font-bold text-red-600">{gameStats.totalLosses}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Win Rate</p>
                        <p className="text-2xl font-bold">{gameStats.winRate.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Avg Attempts</p>
                        <p className="text-2xl font-bold">{gameStats.averageAttempts.toFixed(1)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="games" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Game Attempts</CardTitle>
                  <CardDescription>
                    {gameAttempts.length} total attempts
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading game attempts...
                    </div>
                  ) : gameAttempts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No game attempts found
                    </div>
                  ) : (
                    <ScrollArea className="h-[600px] pr-4">
                      <div className="space-y-2">
                        {gameAttempts.map((attempt) => {
                          const pokemon = getPokemonMetadataById(attempt.target_pokemon_id);
                          const guessedPokemon = attempt.pokemon_guessed
                            ? getPokemonMetadataById(attempt.pokemon_guessed)
                            : null;
                          
                          return (
                            <div
                              key={attempt.id}
                              className="border rounded-lg p-3 space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">
                                    {formatDate(attempt.date)}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    Target: {pokemon?.name || `#${attempt.target_pokemon_id}`}
                                    {attempt.is_shiny && (
                                      <Badge variant="secondary" className="ml-2">Shiny</Badge>
                                    )}
                                  </p>
                                </div>
                                <Badge
                                  variant={attempt.won ? "default" : "destructive"}
                                >
                                  {attempt.won ? "Won" : "Lost"}
                                </Badge>
                              </div>
                              <div className="text-sm space-y-1">
                                <p>
                                  Attempts: {attempt.attempts}/4
                                  {attempt.hints_used > 0 && (
                                    <span className="text-muted-foreground ml-2">
                                      • Hints: {attempt.hints_used}
                                    </span>
                                  )}
                                </p>
                                {attempt.won && guessedPokemon && (
                                  <p className="text-green-600">
                                    Guessed: {guessedPokemon.name}
                                  </p>
                                )}
                                {attempt.guesses && attempt.guesses.length > 0 && (
                                  <p className="text-muted-foreground">
                                    Guesses: {attempt.guesses.length}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="palettes" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Saved Palettes</CardTitle>
                  <CardDescription>
                    {savedPalettes.length} saved palettes
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading palettes...
                    </div>
                  ) : savedPalettes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No saved palettes found
                    </div>
                  ) : (
                    <ScrollArea className="h-[600px] pr-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {savedPalettes.map((palette) => {
                          const pokemon = getPokemonMetadataById(palette.pokemon_id);
                          const spriteData = pokemonSprites[palette.pokemon_id];
                          const spriteUrl = palette.is_shiny
                            ? spriteData?.shiny || spriteData?.normal || null
                            : spriteData?.normal || null;
                          
                          return (
                            <Card
                              key={palette.id}
                              className="overflow-hidden pb-0 relative shadow-none cursor-default"
                            >
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
                            </Card>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

