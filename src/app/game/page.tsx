"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import {
  getAllPokemonMetadata,
  getPokemonById,
  getPokemonMetadataById,
} from "@/lib/pokemon";
import { extractColorsFromImage } from "@/lib/color-extractor";
import { Pokemon } from "@/types/pokemon";
import { PokemonSearch } from "@/components/pokemon-search";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoaderOverlay } from "@/components/loader-overlay";
import { POKEMON_CONSTANTS, FIRST_DAILY_GAME_DATE } from "@/constants/pokemon";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { Footer } from "@/components/footer";
import { CoffeeCTA } from "@/components/coffee-cta";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Flame, TrendingUp, LogIn } from "lucide-react";
import { SignInButton } from "@clerk/nextjs";
import Image from "next/image";

type GameMode = "daily" | "unlimited";
type GameStatus = "playing" | "won" | "lost";

interface Guess {
  pokemonId: number;
  pokemonName: string;
  colors: string[];
  similarity: number;
  spriteUrl: string | null;
}

// Simple hash function for daily seed
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

function getDailyPokemonId(totalPokemon: number, isShiny: boolean): number {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}-${isShiny ? "shiny" : "normal"}`;
  const hash = hashString(dateStr);
  return (hash % totalPokemon) + 1;
}

function getDailyShinyStatus(): boolean {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}-shinystatus`;
  const hash = hashString(dateStr);
  return hash % 2 === 0; // Deterministic shiny status for the day
}

// Calculate color similarity between two palettes
function calculateSimilarity(
  colors1: string[],
  colors2: string[]
): number {
  if (colors1.length === 0 || colors2.length === 0) return 0;

  // Convert hex to RGB
  const hexToRgb = (hex: string) => {
    const hexClean = hex.replace("#", "");
    return {
      r: parseInt(hexClean.substring(0, 2), 16),
      g: parseInt(hexClean.substring(2, 4), 16),
      b: parseInt(hexClean.substring(4, 6), 16),
    };
  };

  // Calculate Euclidean distance between two colors
  const colorDistance = (c1: string, c2: string) => {
    const rgb1 = hexToRgb(c1);
    const rgb2 = hexToRgb(c2);
    return Math.sqrt(
      Math.pow(rgb1.r - rgb2.r, 2) +
        Math.pow(rgb1.g - rgb2.g, 2) +
        Math.pow(rgb1.b - rgb2.b, 2)
    );
  };

  // Find best matches for each color
  let totalSimilarity = 0;
  const maxDistance = Math.sqrt(255 * 255 * 3); // Max possible distance

  colors1.forEach((color1) => {
    let minDistance = Infinity;
    colors2.forEach((color2) => {
      const dist = colorDistance(color1, color2);
      if (dist < minDistance) {
        minDistance = dist;
      }
    });
    // Convert distance to similarity (0-1, where 1 is most similar)
    const similarity = 1 - minDistance / maxDistance;
    totalSimilarity += similarity;
  });

  return totalSimilarity / colors1.length;
}

function getSpriteUrl(pokemon: Pokemon, shiny: boolean): string | null {
  if (typeof pokemon.artwork === "object" && "front" in pokemon.artwork) {
    if (shiny && pokemon.artwork.shiny) {
      return pokemon.artwork.shiny;
    }
    return pokemon.artwork.front || null;
  }
  return null;
}

export default function GamePage() {
  const { user, isLoaded: userLoaded } = useUser();
  const pokemonList = getAllPokemonMetadata();
  const [mode, setMode] = useState<GameMode>("daily");
  const [isShiny, setIsShiny] = useState<boolean | null>(null);
  const [targetPokemonId, setTargetPokemonId] = useState<number | null>(null);
  const [targetPokemon, setTargetPokemon] = useState<Pokemon | null>(null);
  const [targetColors, setTargetColors] = useState<string[]>([]);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [status, setStatus] = useState<GameStatus>("playing");
  const [loading, setLoading] = useState(false);
  const [loadingGuess, setLoadingGuess] = useState(false);
  const [savingAttempt, setSavingAttempt] = useState(false);
  const [userStats, setUserStats] = useState<{
    currentStreak: number;
    longestStreak: number;
    totalGames: number;
    totalWins: number;
    winRate: number;
  } | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [currentUserPosition, setCurrentUserPosition] = useState<number | null>(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [pendingAttempts, setPendingAttempts] = useState<any[]>([]);

  const MAX_ATTEMPTS = 4;
  
  const PENDING_ATTEMPTS_KEY = "pokemon-palette-pending-attempts";

  // Randomly determine shiny status (50% chance)
  const getRandomShiny = (): boolean => {
    return Math.random() < 0.5;
  };

  // Check if user has already played today's daily game
  useEffect(() => {
    const checkTodayAttempt = async () => {
      if (mode !== "daily") {
        return;
      }

      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      // Check localStorage for signed-out users
      if (!user) {
        try {
          const pending = localStorage.getItem(PENDING_ATTEMPTS_KEY);
          if (pending) {
            const attempts = JSON.parse(pending);
            const todayAttempt = attempts.find((a: any) => a.date === dateStr);
            
            if (todayAttempt) {
              // User has pending attempt for today - load it
              const targetPokemonData = await getPokemonById(todayAttempt.targetPokemonId);
              if (targetPokemonData) {
                setTargetPokemonId(todayAttempt.targetPokemonId);
                setTargetPokemon(targetPokemonData);
                setIsShiny(todayAttempt.isShiny);
                
                // Load target colors
                const spriteUrl = getSpriteUrl(targetPokemonData, todayAttempt.isShiny);
                if (spriteUrl) {
                  try {
                    const colors = await extractColorsFromImage(
                      spriteUrl,
                      POKEMON_CONSTANTS.COLORS_TO_EXTRACT
                    );
                    const topColors = colors.slice(0, POKEMON_CONSTANTS.PALETTE_COLORS_COUNT);
                    setTargetColors(topColors);
                    
                    // Load guesses
                    const guessIds = Array.isArray(todayAttempt.guesses) ? todayAttempt.guesses : [];
                    const guessesPromises = guessIds.map(async (pokemonId: number) => {
                      const guessMetadata = getPokemonMetadataById(pokemonId);
                      if (!guessMetadata) return null;

                      const guessPokemon = await getPokemonById(pokemonId);
                      if (!guessPokemon) return null;

                      const guessSpriteUrl = getSpriteUrl(guessPokemon, false);
                      let guessColors: string[] = [];

                      if (guessSpriteUrl) {
                        try {
                          const colors = await extractColorsFromImage(
                            guessSpriteUrl,
                            POKEMON_CONSTANTS.COLORS_TO_EXTRACT
                          );
                          guessColors = colors.slice(0, POKEMON_CONSTANTS.PALETTE_COLORS_COUNT);
                        } catch {
                          guessColors = guessPokemon.colorPalette?.highlights?.slice(0, POKEMON_CONSTANTS.PALETTE_COLORS_COUNT) || [];
                        }
                      }

                      return {
                        pokemonId,
                        pokemonName: guessMetadata.name,
                        colors: guessColors,
                        similarity: calculateSimilarity(topColors, guessColors),
                        spriteUrl: guessSpriteUrl,
                      };
                    });

                    const loadedGuesses = (await Promise.all(guessesPromises)).filter((g): g is Guess => g !== null);
                    setGuesses(loadedGuesses);
                    setAttempts(todayAttempt.attempts);
                    setStatus(todayAttempt.won ? "won" : "lost");
                  } catch (error) {
                    console.error("Failed to load pending attempt:", error);
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error("Error checking pending attempts:", error);
        }
        return;
      }

      // Check API for signed-in users
      try {
        const response = await fetch(`/api/daily-game-attempts?date=${dateStr}`);
        if (response.ok) {
          const data = await response.json();
          if (data.attempts && data.attempts.length > 0) {
            const todayAttempt = data.attempts[0];
            
            // User has already played today - load their attempt
            const targetPokemonData = await getPokemonById(todayAttempt.target_pokemon_id);
            if (targetPokemonData) {
              setTargetPokemonId(todayAttempt.target_pokemon_id);
              setTargetPokemon(targetPokemonData);
              setIsShiny(todayAttempt.is_shiny);
              
              // Load the target colors
              const spriteUrl = getSpriteUrl(targetPokemonData, todayAttempt.is_shiny);
              if (spriteUrl) {
                try {
                  const colors = await extractColorsFromImage(
                    spriteUrl,
                    POKEMON_CONSTANTS.COLORS_TO_EXTRACT
                  );
                  const topColors = colors.slice(
                    0,
                    POKEMON_CONSTANTS.PALETTE_COLORS_COUNT
                  );
                  setTargetColors(topColors);
                } catch (error) {
                  console.error("Failed to extract colors:", error);
                  const fallbackColors =
                    targetPokemonData.colorPalette?.highlights?.slice(
                      0,
                      POKEMON_CONSTANTS.PALETTE_COLORS_COUNT
                    ) || [];
                  setTargetColors(fallbackColors);
                }
              }

              // Wait for target colors to be loaded before loading guesses
              await new Promise(resolve => setTimeout(resolve, 100));

              // Load previous guesses
              const guessPokemonIds = Array.isArray(todayAttempt.guesses) 
                ? todayAttempt.guesses 
                : [];
              
              const guessesPromises = guessPokemonIds.map(async (pokemonId: number) => {
                const guessMetadata = getPokemonMetadataById(pokemonId);
                if (!guessMetadata) return null;

                const guessPokemon = await getPokemonById(pokemonId);
                if (!guessPokemon) return null;

                const spriteUrl = getSpriteUrl(guessPokemon, false);
                let guessColors: string[] = [];

                if (spriteUrl) {
                  try {
                    const colors = await extractColorsFromImage(
                      spriteUrl,
                      POKEMON_CONSTANTS.COLORS_TO_EXTRACT
                    );
                    guessColors = colors.slice(0, POKEMON_CONSTANTS.PALETTE_COLORS_COUNT);
                  } catch (error) {
                    guessColors =
                      guessPokemon.colorPalette?.highlights?.slice(
                        0,
                        POKEMON_CONSTANTS.PALETTE_COLORS_COUNT
                      ) || [];
                  }
                }

                return {
                  pokemonId,
                  pokemonName: guessMetadata.name,
                  colors: guessColors,
                  similarity: 0, // Will be recalculated with actual target colors
                  spriteUrl,
                };
              });

              const loadedGuesses = (await Promise.all(guessesPromises)).filter(
                (g): g is Guess => g !== null
              );

              // Recalculate similarity with actual target colors once they're loaded
              setTargetColors((prevColors) => {
                if (prevColors.length > 0) {
                  const updatedGuesses = loadedGuesses.map((guess) => ({
                    ...guess,
                    similarity: calculateSimilarity(prevColors, guess.colors),
                  }));
                  setGuesses(updatedGuesses);
                } else {
                  setGuesses(loadedGuesses);
                }
                return prevColors;
              });

              setAttempts(todayAttempt.attempts);
              setStatus(todayAttempt.won ? "won" : "lost");
            }
          }
        }
      } catch (error) {
        console.error("Error checking today's attempt:", error);
      }
    };

    checkTodayAttempt();
  }, [mode, user?.id]);

  // Initialize game
  useEffect(() => {
    const initializeGame = async () => {
      // Skip initialization if already loaded from today's attempt (daily mode only)
      if (mode === "daily" && status !== "playing" && guesses.length > 0) {
        return;
      }

      setLoading(true);
      
      // Randomly determine shiny status for this game
      const gameShiny = mode === "daily" 
        ? getDailyShinyStatus() // Deterministic for daily based on date
        : getRandomShiny(); // Random for unlimited
      
      setIsShiny(gameShiny);
      
      let pokemonId: number;

      if (mode === "daily") {
        pokemonId = getDailyPokemonId(pokemonList.length, gameShiny);
      } else {
        // Unlimited mode: always choose a new random Pokemon
        const randomIndex = Math.floor(Math.random() * pokemonList.length);
        pokemonId = pokemonList[randomIndex].id;
      }

      setTargetPokemonId(pokemonId);
      const pokemonData = await getPokemonById(pokemonId);

      if (pokemonData) {
        setTargetPokemon(pokemonData);
        const spriteUrl = getSpriteUrl(pokemonData, gameShiny);
        if (spriteUrl) {
          try {
            const colors = await extractColorsFromImage(
              spriteUrl,
              POKEMON_CONSTANTS.COLORS_TO_EXTRACT
            );
            const topColors = colors.slice(
              0,
              POKEMON_CONSTANTS.PALETTE_COLORS_COUNT
            );
            setTargetColors(topColors);
          } catch (error) {
            console.error("Failed to extract colors:", error);
            const fallbackColors =
              pokemonData.colorPalette?.highlights?.slice(
                0,
                POKEMON_CONSTANTS.PALETTE_COLORS_COUNT
              ) || [];
            setTargetColors(fallbackColors);
          }
        }
      }

      // Only reset if not already set from previous attempt (for signed-out users with pending attempts)
      const hasPendingAttempt = mode === "daily" && !user && (() => {
        try {
          const pending = localStorage.getItem(PENDING_ATTEMPTS_KEY);
          if (pending) {
            const attempts = JSON.parse(pending);
            const today = new Date();
            const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
            return attempts.some((a: any) => a.date === dateStr);
          }
        } catch {
          return false;
        }
        return false;
      })();

      if (guesses.length === 0 && !hasPendingAttempt) {
        setGuesses([]);
        setAttempts(0);
        setStatus("playing");
      }
      setLoading(false);
    };

    initializeGame();
  }, [mode, pokemonList.length]);

  // Fetch user stats and leaderboard for daily mode
  useEffect(() => {
    const fetchStats = async () => {
      if (mode !== "daily") {
        setUserStats(null);
        setLeaderboard([]);
        return;
      }

      // Always fetch leaderboard (works without auth)
      setLoadingLeaderboard(true);
      try {
        const leaderboardResponse = await fetch(
          "/api/daily-game-attempts/leaderboard?limit=10&sortBy=currentStreak"
        );
        if (leaderboardResponse.ok) {
          const leaderboardData = await leaderboardResponse.json();
          setLeaderboard(leaderboardData.leaderboard || []);
          setCurrentUserPosition(leaderboardData.currentUserPosition || null);
        }
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      } finally {
        setLoadingLeaderboard(false);
      }

      // Only fetch user stats if signed in
      if (!user) {
        setUserStats(null);
        return;
      }

      try {
        // Fetch user stats
        const statsResponse = await fetch("/api/daily-game-attempts?stats=true");
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          if (statsData.stats) {
            setUserStats(statsData.stats);
          }
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    };

    fetchStats();
  }, [mode, user, status]); // Refresh when game status changes

  const handleGuess = async (pokemonId: number) => {
    if (status !== "playing" || loadingGuess) return;

    // Prevent duplicate guesses
    if (guesses.some((g) => g.pokemonId === pokemonId)) {
      return;
    }

    setLoadingGuess(true);
    const guessedMetadata = getPokemonMetadataById(pokemonId);
    if (!guessedMetadata) {
      setLoadingGuess(false);
      return;
    }

    const guessedPokemon = await getPokemonById(pokemonId);
    if (!guessedPokemon) {
      setLoadingGuess(false);
      return;
    }

    // For guesses, always use normal sprite (not shiny) since we're comparing to target
    const spriteUrl = getSpriteUrl(guessedPokemon, false);
    let guessColors: string[] = [];

    if (spriteUrl) {
      try {
        const colors = await extractColorsFromImage(
          spriteUrl,
          POKEMON_CONSTANTS.COLORS_TO_EXTRACT
        );
        guessColors = colors.slice(0, POKEMON_CONSTANTS.PALETTE_COLORS_COUNT);
      } catch (error) {
        console.error("Failed to extract colors from guess:", error);
        guessColors =
          guessedPokemon.colorPalette?.highlights?.slice(
            0,
            POKEMON_CONSTANTS.PALETTE_COLORS_COUNT
          ) || [];
      }
    }

    const similarity = calculateSimilarity(targetColors, guessColors);
    const newGuess: Guess = {
      pokemonId,
      pokemonName: guessedMetadata.name,
      colors: guessColors,
      similarity,
      spriteUrl,
    };

    const newAttempts = attempts + 1;
    const allGuesses = [...guesses, newGuess];
    setGuesses(allGuesses);
    setAttempts(newAttempts);

    // Check win condition
    const won = pokemonId === targetPokemonId;
    const lost = !won && newAttempts >= MAX_ATTEMPTS;
    
    if (won) {
      setStatus("won");
      // Save attempt for daily mode only
      if (mode === "daily") {
        if (user) {
          saveGameAttempt(true, pokemonId, allGuesses, newAttempts);
        } else {
          // Store in localStorage for signed-out users
          storePendingAttempt(true, pokemonId, allGuesses, newAttempts);
        }
      }
    } else if (lost) {
      setStatus("lost");
      // Save attempt for daily mode only
      if (mode === "daily") {
        if (user) {
          saveGameAttempt(false, undefined, allGuesses, newAttempts);
        } else {
          // Store in localStorage for signed-out users
          storePendingAttempt(false, undefined, allGuesses, newAttempts);
        }
      }
    }

    setLoadingGuess(false);
  };

  // Store pending attempt in localStorage (for signed-out users)
  const storePendingAttempt = (
    won: boolean,
    pokemonGuessed: number | undefined,
    allGuesses: Guess[],
    finalAttempts: number
  ) => {
    if (mode !== "daily" || !targetPokemonId) return;

    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    
    const attemptData = {
      date: dateStr,
      targetPokemonId: targetPokemonId,
      isShiny: isShiny === true,
      guesses: allGuesses.map((g) => g.pokemonId),
      attempts: finalAttempts,
      won: won,
      pokemonGuessed: won && pokemonGuessed ? pokemonGuessed : undefined,
    };

    // Get existing pending attempts
    const existing = localStorage.getItem(PENDING_ATTEMPTS_KEY);
    const pending = existing ? JSON.parse(existing) : [];
    
    // Check if we already have an attempt for this date
    const existingIndex = pending.findIndex((p: any) => p.date === dateStr);
    
    if (existingIndex >= 0) {
      // Update existing attempt
      pending[existingIndex] = attemptData;
    } else {
      // Add new attempt
      pending.push(attemptData);
    }
    
    localStorage.setItem(PENDING_ATTEMPTS_KEY, JSON.stringify(pending));
    setPendingAttempts(pending);
  };

  // Save game attempt to the database (only for daily mode)
  const saveGameAttempt = async (
    won: boolean,
    pokemonGuessed: number | undefined,
    allGuesses: Guess[],
    finalAttempts: number
  ) => {
    if (!user || mode !== "daily" || !targetPokemonId || savingAttempt) return;

    setSavingAttempt(true);
    try {
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      
      const attemptData = {
        date: dateStr,
        targetPokemonId: targetPokemonId,
        isShiny: isShiny === true,
        guesses: allGuesses.map((g) => g.pokemonId),
        attempts: finalAttempts,
        won: won,
        pokemonGuessed: won && pokemonGuessed ? pokemonGuessed : undefined,
      };

      const response = await fetch("/api/daily-game-attempts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(attemptData),
      });

      if (!response.ok) {
        console.error("Failed to save game attempt");
      }
    } catch (error) {
      console.error("Error saving game attempt:", error);
    } finally {
      setSavingAttempt(false);
    }
  };

  // Sync pending attempts when user signs in
  const syncPendingAttempts = async () => {
    if (!user) return;

    const pending = localStorage.getItem(PENDING_ATTEMPTS_KEY);
    if (!pending) return;

    const attempts = JSON.parse(pending);
    if (attempts.length === 0) return;

    setSavingAttempt(true);
    try {
      // Sync each pending attempt
      const syncPromises = attempts.map(async (attempt: any) => {
        const response = await fetch("/api/daily-game-attempts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(attempt),
        });

        if (response.ok) {
          return true;
        }
        return false;
      });

      const results = await Promise.all(syncPromises);
      
      // Only remove successfully synced attempts
      const failedAttempts = attempts.filter((_: any, index: number) => !results[index]);
      
      if (failedAttempts.length > 0) {
        localStorage.setItem(PENDING_ATTEMPTS_KEY, JSON.stringify(failedAttempts));
        setPendingAttempts(failedAttempts);
      } else {
        localStorage.removeItem(PENDING_ATTEMPTS_KEY);
        setPendingAttempts([]);
      }
    } catch (error) {
      console.error("Error syncing pending attempts:", error);
    } finally {
      setSavingAttempt(false);
    }
  };

  // Load pending attempts on mount
  useEffect(() => {
    const pending = localStorage.getItem(PENDING_ATTEMPTS_KEY);
    if (pending) {
      setPendingAttempts(JSON.parse(pending));
    }
  }, []);

  // Sync pending attempts when user signs in
  useEffect(() => {
    if (user) {
      const pending = localStorage.getItem(PENDING_ATTEMPTS_KEY);
      if (pending && JSON.parse(pending).length > 0) {
        syncPendingAttempts();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Only sync when user ID changes (signs in)

  const resetGame = async () => {
    // Don't allow reset for daily mode if already completed
    if (mode === "daily" && status !== "playing") {
      return;
    }

    setGuesses([]);
    setAttempts(0);
    setStatus("playing");
    setLoading(true);

    // Randomly determine shiny status for this game
    const gameShiny = mode === "daily" 
      ? getDailyShinyStatus() // Deterministic for daily based on date
      : getRandomShiny(); // Random for unlimited
    
    setIsShiny(gameShiny);

    let pokemonId: number;
    if (mode === "daily") {
      pokemonId = getDailyPokemonId(pokemonList.length, gameShiny);
    } else {
      // Unlimited mode: always choose a new random Pokemon
      const randomIndex = Math.floor(Math.random() * pokemonList.length);
      pokemonId = pokemonList[randomIndex].id;
    }

    setTargetPokemonId(pokemonId);
    const pokemonData = await getPokemonById(pokemonId);

    if (pokemonData) {
      setTargetPokemon(pokemonData);
      const spriteUrl = getSpriteUrl(pokemonData, gameShiny);
      if (spriteUrl) {
        try {
          const colors = await extractColorsFromImage(
            spriteUrl,
            POKEMON_CONSTANTS.COLORS_TO_EXTRACT
          );
          const topColors = colors.slice(
            0,
            POKEMON_CONSTANTS.PALETTE_COLORS_COUNT
          );
          setTargetColors(topColors);
        } catch (error) {
          console.error("Failed to extract colors:", error);
          const fallbackColors =
            pokemonData.colorPalette?.highlights?.slice(
              0,
              POKEMON_CONSTANTS.PALETTE_COLORS_COUNT
            ) || [];
          setTargetColors(fallbackColors);
        }
      }
    }

    setLoading(false);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <CoffeeCTA primaryColor={targetColors[0]} />
      <CollapsibleSidebar primaryColor={targetColors[0]} />
      <div className="flex-1 flex flex-col h-full overflow-auto">
        <LoaderOverlay loading={loading} text="Loading game..." />

        <div className="w-full max-w-4xl mx-auto p-4 md:p-8 flex flex-col items-center justify-start gap-6 md:gap-8 flex-1">
        <h1 className="text-3xl md:text-4xl font-bold text-center mb-6">
          Pokemon Palette Guesser
        </h1>

        {/* Game Number and Date - Daily Mode Only */}
        {mode === "daily" && (() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const startDate = new Date(FIRST_DAILY_GAME_DATE);
          startDate.setHours(0, 0, 0, 0);
          const daysDiff = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          const gameNumber = daysDiff + 1;
          const dateStr = today.toLocaleDateString("en-US", { 
            weekday: "long",
            year: "numeric", 
            month: "long", 
            day: "numeric" 
          });
          
          return (
            <div className="w-full mb-4 text-center">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">Game #{gameNumber}</span>
                </div>
                <div className="hidden sm:block">•</div>
                <div className="flex items-center gap-2">
                  <span>{dateStr}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Mode Selection */}
        <div className="w-full flex flex-col gap-4 mb-6">
          <Tabs
            value={mode}
            onValueChange={(value) => {
              const newMode = value as GameMode;
              // Reset game state when switching modes
              if (newMode === "unlimited") {
                setGuesses([]);
                setAttempts(0);
                setStatus("playing");
              }
              setMode(newMode);
            }}
            className="w-full"
          >
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="daily" className="cursor-pointer">
                Daily
              </TabsTrigger>
              <TabsTrigger value="unlimited" className="cursor-pointer">
                Unlimited
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* User Stats - Daily Mode Only */}
        {mode === "daily" && userStats && (
          <div className="mb-4 p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Current Streak</p>
                  <p className="text-lg font-bold">{userStats.currentStreak} days</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Best Streak</p>
                  <p className="text-lg font-bold">{userStats.longestStreak} days</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Win Rate</p>
                  <p className="text-lg font-bold">
                    {userStats.totalGames > 0
                      ? Math.round(userStats.winRate)
                      : 0}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Target Palette Display */}
        {targetColors.length > 0 && (
          <div className="mb-6 p-4 rounded-lg border bg-card shadow-none">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-lg font-semibold">Target Palette</h2>
              {isShiny === true && (
                <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30">
                  ✨ Shiny
                </span>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {targetColors.map((color, index) => (
                <div
                  key={index}
                  className="h-16 w-16 md:h-20 md:w-20 rounded-md border-2 shadow-none"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Attempts remaining: {MAX_ATTEMPTS - attempts}
            </p>
          </div>
        )}

        {/* Game Status */}
        {status === "won" && (
          <div className="mb-6 p-4 rounded-lg border bg-green-500/10 border-green-500/50">
            <h2 className="text-xl font-bold text-green-600 dark:text-green-400 mb-2">
              🎉 You Won!
            </h2>
            {targetPokemon && (
              <p className="text-muted-foreground">
                The Pokemon was {targetPokemon.name}
                {isShiny === true ? " (Shiny)" : ""}!
              </p>
            )}
            {mode === "daily" && !user && (
              <div className="mt-4 p-3 rounded-md bg-primary/10 border border-primary/30">
                <p className="text-sm text-muted-foreground mb-2">
                  Sign in to save your progress and compete on the leaderboard!
                </p>
                <SignInButton mode="modal">
                  <Button className="w-full cursor-pointer">
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In to Save Progress
                  </Button>
                </SignInButton>
              </div>
            )}
            {mode === "unlimited" && (
              <Button onClick={resetGame} className="mt-4">
                Play Again
              </Button>
            )}
          </div>
        )}

        {status === "lost" && (
          <div className="mb-6 p-4 rounded-lg border bg-red-500/10 border-red-500/50">
            <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">
              Game Over
            </h2>
            {targetPokemon && (
              <p className="text-muted-foreground">
                The Pokemon was {targetPokemon.name}
                {isShiny === true ? " (Shiny)" : ""}!
              </p>
            )}
            {mode === "daily" && !user && (
              <div className="mt-4 p-3 rounded-md bg-primary/10 border border-primary/30">
                <p className="text-sm text-muted-foreground mb-2">
                  Sign in to save your progress and compete on the leaderboard!
                </p>
                <SignInButton mode="modal">
                  <Button className="w-full cursor-pointer">
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In to Save Progress
                  </Button>
                </SignInButton>
              </div>
            )}
            {mode === "unlimited" && (
              <Button onClick={resetGame} className="mt-4">
                Try Again
              </Button>
            )}
          </div>
        )}

        {/* Guess Input - Only show when playing */}
        {status === "playing" && (
          <div className="mb-6">
            <PokemonSearch
              pokemonList={pokemonList}
              selectedPokemon={null}
              onPokemonSelect={handleGuess}
            />
            {loadingGuess && (
              <p className="text-sm text-muted-foreground mt-2">
                Analyzing guess...
              </p>
            )}
          </div>
        )}

        {/* CTA to play unlimited after daily game is complete */}
        {mode === "daily" && status !== "playing" && (
          <div className="mb-6 p-4 rounded-lg border bg-card">
            <p className="text-sm text-muted-foreground mb-3">
              Want to keep playing? Try unlimited mode with random Pokemon!
            </p>
            <Button
              onClick={() => setMode("unlimited")}
              className="w-full cursor-pointer"
            >
              Play Unlimited Mode
            </Button>
          </div>
        )}

        {/* Previous Guesses */}
        {guesses.length > 0 && (
          <div className="space-y-4 w-full">
            <h2 className="text-lg font-semibold">Your Guesses</h2>
            {guesses.map((guess, index) => (
              <div
                key={index}
                className="p-4 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-4 mb-3 flex-wrap">
                  {guess.spriteUrl && (
                    <div className="relative">
                      <Image
                        src={guess.spriteUrl}
                        alt={guess.pokemonName}
                        width={64}
                        height={64}
                        className="w-16 h-16 object-contain"
                        style={{ imageRendering: "pixelated" }}
                        unoptimized
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{guess.pokemonName}</h3>
                    <span className="text-sm text-muted-foreground">
                      Similarity: {Math.round(guess.similarity * 100)}%
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {guess.colors.map((color, colorIndex) => (
                    <div
                      key={colorIndex}
                      className="h-12 w-12 md:h-16 md:w-16 rounded-md border-2"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Leaderboard - Daily Mode Only */}
        {mode === "daily" && (
          <div className="w-full mt-6">
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <h2 className="text-lg font-semibold">Leaderboard</h2>
              </div>

              {loadingLeaderboard ? (
                <div className="text-center py-4 text-muted-foreground">
                  Loading leaderboard...
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No leaderboard data yet. Be the first to play!
                </div>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((entry, index) => {
                    const isCurrentUser = user && entry.userId === user.id;
                    const displayName =
                      entry.username ||
                      `${entry.firstName || ""} ${entry.lastName || ""}`.trim() ||
                      "Anonymous";

                    return (
                      <div
                        key={entry.userId}
                        className={`flex items-center gap-3 p-3 rounded-md border transition-colors ${
                          isCurrentUser
                            ? "bg-primary/10 border-primary/30"
                            : "bg-background"
                        }`}
                      >
                        <div className="flex-shrink-0 w-8 text-center">
                          <span
                            className={`text-sm font-bold ${
                              index === 0
                                ? "text-yellow-500"
                                : index === 1
                                ? "text-gray-400"
                                : index === 2
                                ? "text-orange-600"
                                : "text-muted-foreground"
                            }`}
                          >
                            #{index + 1}
                          </span>
                        </div>
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={entry.imageUrl || undefined}
                            alt={displayName}
                          />
                          <AvatarFallback>
                            {displayName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-medium truncate ${
                              isCurrentUser ? "text-primary" : "text-foreground"
                            }`}
                          >
                            {displayName}
                            {isCurrentUser && " (You)"}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="text-center">
                            <div className="font-semibold text-foreground">
                              {entry.currentStreak}
                            </div>
                            <div>Streak</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-foreground">
                              {entry.winRate}%
                            </div>
                            <div>Win</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-foreground">
                              {entry.totalWins}
                            </div>
                            <div>Wins</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {currentUserPosition !== null &&
                currentUserPosition > 10 && (
                  <div className="mt-4 pt-4 border-t text-center text-sm text-muted-foreground">
                    Your position: #{currentUserPosition}
                  </div>
                )}
            </div>
          </div>
        )}
        </div>
        <Footer />
      </div>
    </div>
  );
}

