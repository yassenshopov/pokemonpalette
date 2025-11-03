"use client";

import { useState, useEffect, useRef } from "react";
import { gsap } from "gsap";
import { useUser } from "@clerk/nextjs";
import confetti from "canvas-confetti";
import {
  getAllPokemonMetadata,
  getPokemonById,
  getPokemonMetadataById,
} from "@/lib/pokemon";
import {
  extractColorsFromImage,
  type ColorWithFrequency,
} from "@/lib/color-extractor";
import { Pokemon } from "@/types/pokemon";
import { PokemonSearch } from "@/components/pokemon-search";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoaderOverlay } from "@/components/loader-overlay";
import { POKEMON_CONSTANTS, FIRST_DAILY_GAME_DATE } from "@/constants/pokemon";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { Footer } from "@/components/footer";
import { CoffeeCTA } from "@/components/coffee-cta";
import { RefreshCw, Lightbulb, Flag, Sparkles, Search } from "lucide-react";
import { GameResultDialog } from "@/components/game-result-dialog";
import { UserStatsPanel } from "@/components/user-stats-panel";
import { GameLeaderboard } from "@/components/game-leaderboard";
import { GameDateHeader } from "@/components/game-date-header";
import { GuessCard } from "@/components/guess-card";
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
  const dateStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}-${
    isShiny ? "shiny" : "normal"
  }`;
  const hash = hashString(dateStr);
  return (hash % totalPokemon) + 1;
}

function getDailyShinyStatus(): boolean {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}-shinystatus`;
  const hash = hashString(dateStr);
  return hash % 2 === 0; // Deterministic shiny status for the day
}

// Helper function to determine if text should be dark or light based on background
const getTextColor = (hex: string | undefined): "text-white" | "text-black" => {
  if (!hex || typeof hex !== "string") {
    return "text-black";
  }
  const hexClean = hex.replace("#", "");
  const r = parseInt(hexClean.substring(0, 2), 16);
  const g = parseInt(hexClean.substring(2, 4), 16);
  const b = parseInt(hexClean.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "text-black" : "text-white";
};

// Calculate color similarity between two palettes
function calculateSimilarity(
  colors1: string[] | ColorWithFrequency[],
  colors2: string[]
): number {
  // Convert ColorWithFrequency[] to string[] if needed
  const color1Strings = colors1.map((c) => (typeof c === "string" ? c : c.hex));
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
    const color1Hex = typeof color1 === "string" ? color1 : color1.hex;
    let minDistance = Infinity;
    colors2.forEach((color2) => {
      const dist = colorDistance(color1Hex, color2);
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
  const [targetColors, setTargetColors] = useState<ColorWithFrequency[]>([]);
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
  const [currentUserPosition, setCurrentUserPosition] = useState<number | null>(
    null
  );
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [pendingAttempts, setPendingAttempts] = useState<any[]>([]);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [revealedHints, setRevealedHints] = useState<number[]>([]);
  const [hintCooldown, setHintCooldown] = useState(0); // Cooldown in seconds (0-5)
  const [showGameResultDialog, setShowGameResultDialog] = useState(false);
  const hintRefs = useRef<(HTMLDivElement | null)[]>([]);
  const guessRefs = useRef<(HTMLDivElement | null)[]>([]);

  const MAX_ATTEMPTS = 4;

  const PENDING_ATTEMPTS_KEY = "pokemon-palette-pending-attempts";

  // Randomly determine shiny status (50% chance)
  const getRandomShiny = (): boolean => {
    return Math.random() < 0.5;
  };

  // Set checkingAuth based on mode
  useEffect(() => {
    if (mode !== "daily") {
      setCheckingAuth(false);
    } else {
      // For daily mode, wait for auth check
      setCheckingAuth(true);
    }
  }, [mode]);

  // Check if user has already played today's daily game
  useEffect(() => {
    const checkTodayAttempt = async () => {
      if (mode !== "daily") {
        return;
      }

      // Wait for auth to be loaded before checking
      if (!userLoaded) {
        return;
      }

      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(
        today.getMonth() + 1
      ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      // Check localStorage for signed-out users
      if (!user) {
        try {
          const pending = localStorage.getItem(PENDING_ATTEMPTS_KEY);
          if (pending) {
            const attempts = JSON.parse(pending);
            const todayAttempt = attempts.find((a: any) => a.date === dateStr);

            if (todayAttempt) {
              // User has pending attempt for today - load it
              const targetPokemonData = await getPokemonById(
                todayAttempt.targetPokemonId
              );
              if (targetPokemonData) {
                setTargetPokemonId(todayAttempt.targetPokemonId);
                setTargetPokemon(targetPokemonData);
                setIsShiny(todayAttempt.isShiny);

                // Load target colors
                const spriteUrl = getSpriteUrl(
                  targetPokemonData,
                  todayAttempt.isShiny
                );
                if (spriteUrl) {
                  try {
                    const colors = (await extractColorsFromImage(
                      spriteUrl,
                      POKEMON_CONSTANTS.COLORS_TO_EXTRACT,
                      true
                    )) as ColorWithFrequency[];
                    const topColors = colors.slice(
                      0,
                      POKEMON_CONSTANTS.PALETTE_COLORS_COUNT
                    );
                    setTargetColors(topColors);

                    // Load guesses
                    const guessIds = Array.isArray(todayAttempt.guesses)
                      ? todayAttempt.guesses
                      : [];
                    const guessesPromises = guessIds.map(
                      async (pokemonId: number) => {
                        const guessMetadata = getPokemonMetadataById(pokemonId);
                        if (!guessMetadata) return null;

                        const guessPokemon = await getPokemonById(pokemonId);
                        if (!guessPokemon) return null;

                        const guessSpriteUrl = getSpriteUrl(
                          guessPokemon,
                          todayAttempt.isShiny
                        );
                        let guessColors: string[] = [];

                        if (guessSpriteUrl) {
                          try {
                            const colors = await extractColorsFromImage(
                              guessSpriteUrl,
                              POKEMON_CONSTANTS.COLORS_TO_EXTRACT
                            );
                            guessColors = colors
                              .slice(0, POKEMON_CONSTANTS.PALETTE_COLORS_COUNT)
                              .map((c) => (typeof c === "string" ? c : c.hex));
                          } catch {
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
                          similarity: calculateSimilarity(
                            topColors.map((c) => c.hex),
                            guessColors
                          ),
                          spriteUrl: guessSpriteUrl,
                        };
                      }
                    );

                    const loadedGuesses = (
                      await Promise.all(guessesPromises)
                    ).filter((g): g is Guess => g !== null);
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
        setCheckingAuth(false);
        return;
      }

      // Check API for signed-in users
      try {
        const response = await fetch(
          `/api/daily-game-attempts?date=${dateStr}`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.attempts && data.attempts.length > 0) {
            const todayAttempt = data.attempts[0];

            // User has already played today - load their attempt
            const targetPokemonData = await getPokemonById(
              todayAttempt.target_pokemon_id
            );
            if (targetPokemonData) {
              setTargetPokemonId(todayAttempt.target_pokemon_id);
              setTargetPokemon(targetPokemonData);
              setIsShiny(todayAttempt.is_shiny);

              // Load the target colors
              const spriteUrl = getSpriteUrl(
                targetPokemonData,
                todayAttempt.is_shiny
              );
              if (spriteUrl) {
                try {
                  const colors = (await extractColorsFromImage(
                    spriteUrl,
                    POKEMON_CONSTANTS.COLORS_TO_EXTRACT,
                    true
                  )) as ColorWithFrequency[];
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
                  // Convert fallback colors to ColorWithFrequency format
                  const fallbackWithFreq: ColorWithFrequency[] =
                    fallbackColors.map((hex, idx) => ({
                      hex,
                      frequency: 100 - idx * 10, // Dummy frequencies for fallback
                      percentage:
                        ((100 - idx * 10) / fallbackColors.length) * 100,
                    }));
                  setTargetColors(fallbackWithFreq);
                }
              }

              // Wait for target colors to be loaded before loading guesses
              await new Promise((resolve) => setTimeout(resolve, 100));

              // Load previous guesses
              const guessPokemonIds = Array.isArray(todayAttempt.guesses)
                ? todayAttempt.guesses
                : [];

              const guessesPromises = guessPokemonIds.map(
                async (pokemonId: number) => {
                  const guessMetadata = getPokemonMetadataById(pokemonId);
                  if (!guessMetadata) return null;

                  const guessPokemon = await getPokemonById(pokemonId);
                  if (!guessPokemon) return null;

                  const spriteUrl = getSpriteUrl(
                    guessPokemon,
                    todayAttempt.is_shiny
                  );
                  let guessColors: string[] = [];

                  if (spriteUrl) {
                    try {
                      const colors = await extractColorsFromImage(
                        spriteUrl,
                        POKEMON_CONSTANTS.COLORS_TO_EXTRACT
                      );
                      guessColors = colors
                        .slice(0, POKEMON_CONSTANTS.PALETTE_COLORS_COUNT)
                        .map((c) => (typeof c === "string" ? c : c.hex));
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
                }
              );

              const loadedGuesses = (await Promise.all(guessesPromises)).filter(
                (g): g is Guess => g !== null
              );

              // Recalculate similarity with actual target colors once they're loaded
              setTargetColors((prevColors) => {
                if (prevColors.length > 0) {
                  const updatedGuesses = loadedGuesses.map((guess) => ({
                    ...guess,
                    similarity: calculateSimilarity(
                      prevColors.map((c) => c.hex),
                      guess.colors
                    ),
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
      } finally {
        setCheckingAuth(false);
      }
    };

    checkTodayAttempt();
    // Reset hints when mode or Pokemon changes
    setRevealedHints([]);
  }, [mode, user?.id, userLoaded]);

  // Initialize game
  useEffect(() => {
    const initializeGame = async () => {
      // Skip initialization if already loaded from today's attempt (daily mode only)
      if (mode === "daily" && status !== "playing" && guesses.length > 0) {
        return;
      }

      // Wait for auth check to complete before initializing
      if (mode === "daily" && checkingAuth) {
        return;
      }

      setLoading(true);

      // Randomly determine shiny status for this game
      const gameShiny =
        mode === "daily"
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
            const colors = (await extractColorsFromImage(
              spriteUrl,
              POKEMON_CONSTANTS.COLORS_TO_EXTRACT,
              true
            )) as ColorWithFrequency[];
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
            // Convert fallback colors to ColorWithFrequency format
            const fallbackWithFreq: ColorWithFrequency[] = fallbackColors.map(
              (hex, idx) => ({
                hex,
                frequency: 100 - idx * 10, // Dummy frequencies for fallback
                percentage: ((100 - idx * 10) / fallbackColors.length) * 100,
              })
            );
            setTargetColors(fallbackWithFreq);
          }
        }
      }

      // Only reset if not already set from previous attempt (for signed-out users with pending attempts)
      const hasPendingAttempt =
        mode === "daily" &&
        !user &&
        (() => {
          try {
            const pending = localStorage.getItem(PENDING_ATTEMPTS_KEY);
            if (pending) {
              const attempts = JSON.parse(pending);
              const today = new Date();
              const dateStr = `${today.getFullYear()}-${String(
                today.getMonth() + 1
              ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
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
        setRevealedHints([]);
        setHintCooldown(0);
      }
      setLoading(false);
    };

    initializeGame();
  }, [mode, pokemonList.length, checkingAuth]);

  // Trigger confetti on win with palette colors
  useEffect(() => {
    if (status === "won" && targetColors.length > 0) {
      // Extract hex colors from targetColors
      const colors = targetColors.map((c) => c.hex);

      // Create confetti with the palette colors
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = {
        startVelocity: 30,
        spread: 360,
        ticks: 60,
        zIndex: 9999,
      };

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min;
      }

      const interval: NodeJS.Timeout = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);

        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: colors,
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: colors,
        });
      }, 250);

      // Cleanup function to clear interval if component unmounts or status changes
      return () => {
        clearInterval(interval);
      };
    }
  }, [status, targetColors]);

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
        const statsResponse = await fetch(
          "/api/daily-game-attempts?stats=true"
        );
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

    // Use shiny sprite for guesses if target is shiny
    const spriteUrl = getSpriteUrl(guessedPokemon, isShiny === true);
    let guessColors: string[] = [];

    if (spriteUrl) {
      try {
        const colors = await extractColorsFromImage(
          spriteUrl,
          POKEMON_CONSTANTS.COLORS_TO_EXTRACT
        );
        guessColors = colors
          .slice(0, POKEMON_CONSTANTS.PALETTE_COLORS_COUNT)
          .map((c) => (typeof c === "string" ? c : c.hex));
      } catch (error) {
        console.error("Failed to extract colors from guess:", error);
        guessColors =
          guessedPokemon.colorPalette?.highlights?.slice(
            0,
            POKEMON_CONSTANTS.PALETTE_COLORS_COUNT
          ) || [];
      }
    }

    const similarity = calculateSimilarity(
      targetColors.map((c) => c.hex),
      guessColors
    );
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
      setShowGameResultDialog(true);
      // Save attempt for daily mode only
      if (mode === "daily") {
        if (user) {
          saveGameAttempt(
            true,
            pokemonId,
            allGuesses,
            newAttempts,
            revealedHints.length
          );
        } else {
          // Store in localStorage for signed-out users
          storePendingAttempt(
            true,
            pokemonId,
            allGuesses,
            newAttempts,
            revealedHints.length
          );
        }
      }
    } else if (lost) {
      setStatus("lost");
      setShowGameResultDialog(true);
      // Save attempt for daily mode only
      if (mode === "daily") {
        if (user) {
          saveGameAttempt(
            false,
            undefined,
            allGuesses,
            newAttempts,
            revealedHints.length
          );
        } else {
          // Store in localStorage for signed-out users
          storePendingAttempt(
            false,
            undefined,
            allGuesses,
            newAttempts,
            revealedHints.length
          );
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
    finalAttempts: number,
    hintsUsed: number = 0
  ) => {
    if (mode !== "daily" || !targetPokemonId) return;

    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const attemptData = {
      date: dateStr,
      targetPokemonId: targetPokemonId,
      isShiny: isShiny === true,
      guesses: allGuesses.map((g) => g.pokemonId),
      attempts: finalAttempts,
      won: won,
      pokemonGuessed: won && pokemonGuessed ? pokemonGuessed : undefined,
      hintsUsed: hintsUsed,
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
    finalAttempts: number,
    hintsUsed: number = 0
  ) => {
    if (!user || mode !== "daily" || !targetPokemonId || savingAttempt) return;

    setSavingAttempt(true);
    try {
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(
        today.getMonth() + 1
      ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      const attemptData = {
        date: dateStr,
        targetPokemonId: targetPokemonId,
        isShiny: isShiny === true,
        guesses: allGuesses.map((g) => g.pokemonId),
        attempts: finalAttempts,
        won: won,
        pokemonGuessed: won && pokemonGuessed ? pokemonGuessed : undefined,
        hintsUsed: hintsUsed,
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
        // Ensure hintsUsed is included (for older attempts that might not have it)
        const attemptWithHints = {
          ...attempt,
          hintsUsed: attempt.hintsUsed ?? 0,
        };
        const response = await fetch("/api/daily-game-attempts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(attemptWithHints),
        });

        if (response.ok) {
          return true;
        }
        return false;
      });

      const results = await Promise.all(syncPromises);

      // Only remove successfully synced attempts
      const failedAttempts = attempts.filter(
        (_: any, index: number) => !results[index]
      );

      if (failedAttempts.length > 0) {
        localStorage.setItem(
          PENDING_ATTEMPTS_KEY,
          JSON.stringify(failedAttempts)
        );
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

  // Get generation from Pokemon ID (since JSON data has incorrect generation)
  const getGenerationFromId = (id: number): number => {
    if (id <= 151) return 1;
    if (id <= 251) return 2;
    if (id <= 386) return 3;
    if (id <= 493) return 4;
    if (id <= 649) return 5;
    if (id <= 721) return 6;
    if (id <= 809) return 7;
    if (id <= 905) return 8;
    if (id <= 1025) return 9;
    return 1; // Default fallback
  };

  // Generate hints from Pokemon data
  const generateHints = (pokemon: Pokemon): string[] => {
    const hints: string[] = [];

    // Hint 1: Type
    if (pokemon.type && pokemon.type.length > 0) {
      const typeHint =
        pokemon.type.length === 1
          ? `This Pokemon is a ${pokemon.type[0]} type.`
          : `This Pokemon is a ${pokemon.type.join("/")} type.`;
      hints.push(typeHint);
    }

    // Hint 2: Generation or physical characteristic
    // Use ID-based generation since JSON data has incorrect generation values
    const generation = getGenerationFromId(pokemon.id);
    if (generation) {
      const genRoman =
        ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"][
          generation - 1
        ] || generation.toString();
      hints.push(`This Pokemon was introduced in Generation ${genRoman}.`);
    } else if (pokemon.height && pokemon.weight) {
      const sizeCategory =
        pokemon.height < 0.5
          ? "very small"
          : pokemon.height < 1.0
          ? "small"
          : pokemon.height < 2.0
          ? "medium-sized"
          : "large";
      const weightCategory =
        pokemon.weight < 10
          ? "light"
          : pokemon.weight < 50
          ? "moderately heavy"
          : "heavy";
      hints.push(
        `This Pokemon is ${sizeCategory} and ${weightCategory}, weighing ${pokemon.weight.toFixed(
          1
        )}kg and standing ${pokemon.height.toFixed(1)}m tall.`
      );
    }

    // Hint 3: Ability or description
    if (pokemon.abilities && pokemon.abilities.length > 0) {
      const abilities =
        typeof pokemon.abilities[0] === "string"
          ? pokemon.abilities
          : (pokemon.abilities as any[])
              .filter((a: any) => !a.is_hidden)
              .map((a: any) => a.name);
      if (abilities.length > 0) {
        const abilityHint =
          abilities.length === 1
            ? `This Pokemon has the ability ${abilities[0]}.`
            : `This Pokemon has abilities like ${abilities[0]}${
                abilities.length > 1 ? ` or ${abilities[1]}` : ""
              }.`;
        hints.push(abilityHint);
      } else {
        // Fallback to description
        if (pokemon.description) {
          hints.push(pokemon.description);
        }
      }
    } else if (pokemon.description) {
      hints.push(pokemon.description);
    }

    // Ensure we have at least 3 hints
    while (hints.length < 3) {
      if (pokemon.rarity) {
        hints.push(`This Pokemon has a ${pokemon.rarity} rarity.`);
      } else if (pokemon.habitat) {
        hints.push(`This Pokemon can be found in ${pokemon.habitat} habitats.`);
      } else {
        hints.push("This Pokemon is a mystery!");
      }
    }

    return hints.slice(0, 3);
  };

  const showNextHint = () => {
    if (!targetPokemon || revealedHints.length >= 3 || hintCooldown > 0) return;
    const nextHintIndex = revealedHints.length;
    setRevealedHints([...revealedHints, nextHintIndex]);
    setHintCooldown(5); // Start 5 second cooldown
  };

  // Timer countdown for hint cooldown
  useEffect(() => {
    if (hintCooldown <= 0) return;

    const interval = setInterval(() => {
      setHintCooldown((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [hintCooldown]);

  // Animate hints when they are revealed
  useEffect(() => {
    if (revealedHints.length > 0 && targetPokemon) {
      const lastRevealedIndex = revealedHints[revealedHints.length - 1];
      const hintElement = hintRefs.current[lastRevealedIndex];

      if (hintElement) {
        // Set initial state
        gsap.set(hintElement, { opacity: 0, y: -20, scale: 0.8 });

        // Animate in
        gsap.to(hintElement, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.5,
          ease: "back.out(1.7)",
        });
      }
    }
  }, [revealedHints, targetPokemon]);

  // Animate guesses when they are added
  useEffect(() => {
    if (guesses.length > 0) {
      const lastGuessIndex = guesses.length - 1;
      const guessElement = guessRefs.current[lastGuessIndex];

      if (guessElement) {
        // Set initial state
        gsap.set(guessElement, { opacity: 0, x: 50, scale: 0.9 });

        // Animate in
        gsap.to(guessElement, {
          opacity: 1,
          x: 0,
          scale: 1,
          duration: 0.6,
          ease: "power3.out",
        });
      }
    }
  }, [guesses]);

  const handleGiveUp = () => {
    if (status !== "playing" || !targetPokemon) return;

    setStatus("lost");
    setShowGameResultDialog(true);

    // Save attempt for daily mode only
    if (mode === "daily") {
      if (user) {
        saveGameAttempt(
          false,
          undefined,
          guesses,
          attempts,
          revealedHints.length
        );
      } else {
        // Store in localStorage for signed-out users
        storePendingAttempt(
          false,
          undefined,
          guesses,
          attempts,
          revealedHints.length
        );
      }
    }
  };

  const resetGame = async () => {
    // Don't allow reset for daily mode if already completed
    if (mode === "daily" && status !== "playing") {
      return;
    }

    setGuesses([]);
    setAttempts(0);
    setStatus("playing");
    setRevealedHints([]);
    setHintCooldown(0);
    setLoading(true);

    // Randomly determine shiny status for this game
    const gameShiny =
      mode === "daily"
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
          const colors = (await extractColorsFromImage(
            spriteUrl,
            POKEMON_CONSTANTS.COLORS_TO_EXTRACT,
            true
          )) as ColorWithFrequency[];
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
          // Convert fallback colors to ColorWithFrequency format
          const fallbackWithFreq: ColorWithFrequency[] = fallbackColors.map(
            (hex, idx) => ({
              hex,
              frequency: 100 - idx * 10, // Dummy frequencies for fallback
              percentage: ((100 - idx * 10) / fallbackColors.length) * 100,
            })
          );
          setTargetColors(fallbackWithFreq);
        }
      }
    }

    setLoading(false);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <CoffeeCTA
        primaryColor={
          targetColors.length > 0 && targetColors[0]?.hex
            ? targetColors[0].hex
            : "#f59e0b"
        }
      />
      <CollapsibleSidebar
        primaryColor={
          targetColors.length > 0 && targetColors[0]?.hex
            ? targetColors[0].hex
            : "#f59e0b"
        }
      />
      <div className="flex-1 flex flex-col h-full overflow-auto relative">
        <LoaderOverlay
          loading={checkingAuth || loading}
          text={checkingAuth ? "Checking authentication..." : "Loading game..."}
        />

        <div className="w-full max-w-4xl mx-auto p-4 md:p-8 flex flex-col items-center justify-start gap-6 md:gap-8 flex-1">
          <h1 className="text-3xl md:text-4xl font-bold text-center mb-6">
            Pokemon Palette Guesser
          </h1>

          {/* Game Number and Date - Daily Mode Only */}
          <GameDateHeader mode={mode} />

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
            <UserStatsPanel userStats={userStats} />
          )}

          {/* Target Palette Display */}
          {targetColors.length > 0 && (
            <div className="mb-6 w-full max-w-6xl p-4 md:p-6 rounded-lg border bg-card shadow-none relative">
              {/* Shiny Badge - Top Left Corner */}
              {isShiny === true && (
                <div className="absolute top-2 left-2 z-10">
                  <Badge
                    variant="default"
                    className="border-transparent text-xs"
                    style={{
                      backgroundColor:
                        targetColors.length > 0
                          ? targetColors[0].hex
                          : undefined,
                      color:
                        targetColors.length > 0 && targetColors[0].hex
                          ? getTextColor(targetColors[0].hex) === "text-white"
                            ? "#ffffff"
                            : "#000000"
                          : undefined,
                    }}
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    Shiny
                  </Badge>
                </div>
              )}

              {/* Show official artwork when game is finished */}
              {status !== "playing" && targetPokemon && (
                <div className="mb-4 flex justify-center">
                  <div className="relative">
                    <Image
                      src={
                        isShiny === true
                          ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${targetPokemon.id}.png`
                          : typeof targetPokemon.artwork === "object" &&
                            "official" in targetPokemon.artwork
                          ? targetPokemon.artwork.official
                          : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${targetPokemon.id}.png`
                      }
                      alt={targetPokemon.name}
                      width={300}
                      height={300}
                      className="w-auto h-48 md:h-64 object-contain"
                      unoptimized
                    />
                  </div>
                </div>
              )}

              <div className="w-full flex gap-1 md:gap-2 h-16 md:h-20 rounded-md overflow-hidden border-2">
                {targetColors.map((color, index) => (
                  <div
                    key={index}
                    className="h-full flex items-center justify-center border-r last:border-r-0 border-border/50"
                    style={{
                      backgroundColor: color.hex,
                      width: `${color.percentage}%`,
                      minWidth: "2rem",
                    }}
                    title={`${color.hex} - ${color.percentage.toFixed(1)}%`}
                  />
                ))}
              </div>

              <div className="flex items-start justify-between mt-4 gap-4">
                <p className="text-sm text-muted-foreground">
                  Attempts remaining: {MAX_ATTEMPTS - attempts}
                </p>
                <div className="flex flex-col items-end gap-2">
                  {/* Hints Display - Right side, in a column */}
                  {status === "playing" &&
                    targetPokemon &&
                    revealedHints.length > 0 && (
                      <div className="flex flex-col gap-2 items-end">
                        {revealedHints.map((hintIndex) => {
                          const hints = generateHints(targetPokemon);
                          const primaryColor =
                            targetColors.length > 0
                              ? targetColors[0].hex
                              : undefined;
                          return (
                            <div
                              key={hintIndex}
                              ref={(el) => {
                                hintRefs.current[hintIndex] = el;
                              }}
                            >
                              <Badge
                                variant="default"
                                className="border-transparent"
                                style={{
                                  backgroundColor: primaryColor || undefined,
                                  color: primaryColor
                                    ? getTextColor(primaryColor) ===
                                      "text-white"
                                      ? "#ffffff"
                                      : "#000000"
                                    : undefined,
                                }}
                              >
                                {hints[hintIndex]}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  {status === "playing" && targetPokemon && (
                    <Button
                      onClick={showNextHint}
                      variant="outline"
                      size="sm"
                      disabled={revealedHints.length >= 3 || hintCooldown > 0}
                      className="text-xs relative overflow-hidden"
                    >
                      {/* Progress bar background */}
                      {hintCooldown > 0 && (
                        <div
                          className="absolute -left-px -top-px -bottom-px bg-primary opacity-30 transition-all duration-1000 ease-linear rounded-l-md"
                          style={{
                            width: `calc(${
                              ((5 - hintCooldown) / 5) * 100
                            }% + 1px)`,
                          }}
                        />
                      )}
                      <Lightbulb className="w-3 h-3 mr-1.5 relative z-10" />
                      <span className="relative z-10">
                        {revealedHints.length === 0
                          ? "Show me a hint"
                          : revealedHints.length === 1
                          ? "Show another hint"
                          : revealedHints.length === 2
                          ? "Show final hint"
                          : "All hints revealed"}
                      </span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {status === "playing" && (
                  <Button
                    onClick={handleGiveUp}
                    variant="outline"
                    className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-300 dark:border-red-700"
                  >
                    <Flag className="w-4 h-4 mr-2" />
                    Give Up
                  </Button>
                )}
                {mode === "unlimited" && (
                  <Button
                    onClick={resetGame}
                    variant="outline"
                    disabled={loading}
                  >
                    <RefreshCw
                      className={`w-4 h-4 mr-2 ${
                        loading ? "animate-spin" : ""
                      }`}
                    />
                    Get New Pokemon
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Game Status Dialog */}
          {(status === "won" || status === "lost") && (
            <GameResultDialog
              open={showGameResultDialog}
              onOpenChange={setShowGameResultDialog}
              status={status}
              targetPokemon={targetPokemon}
              isShiny={isShiny}
              mode={mode}
              user={user}
              onResetGame={resetGame}
            />
          )}

          {/* Two Column Layout: Search (Left) and Guesses (Right) - 50/50 Split */}
          <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Search */}
            <div className="lg:col-span-1">
              {status === "playing" ? (
                <>
                  <PokemonSearch
                    pokemonList={pokemonList}
                    selectedPokemon={null}
                    onPokemonSelect={handleGuess}
                    isShiny={isShiny === true}
                  />
                  {loadingGuess && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Analyzing guess...
                    </p>
                  )}
                </>
              ) : (
                <div className="p-4 rounded-lg border bg-muted/50 text-center text-muted-foreground">
                  <p className="text-sm">Game finished</p>
                </div>
              )}
            </div>

            {/* Right Column: Previous Guesses */}
            <div className="lg:col-span-1">
              <div className="space-y-3 p-4 md:p-6">
                <h2 className="text-lg font-semibold mb-3">Your Guesses</h2>
                {guesses.length > 0 ? (
                  <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto">
                    {guesses.map((guess, index) => (
                      <GuessCard
                        key={index}
                        guess={guess}
                        index={index}
                        onRef={(el) => {
                          guessRefs.current[index] = el;
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground border rounded-lg bg-card">
                    <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm font-medium mb-2">No guesses yet</p>
                    <p className="text-xs">
                      Start guessing to see your attempts here
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

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

          {/* Leaderboard - Daily Mode Only */}
          {mode === "daily" && (
            <GameLeaderboard
              leaderboard={leaderboard}
              loading={loadingLeaderboard}
              currentUserId={user?.id}
              currentUserPosition={currentUserPosition}
            />
          )}
        </div>
        <Footer />
      </div>
    </div>
  );
}
