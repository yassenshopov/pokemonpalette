"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import type { gsap } from "gsap";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { track } from "@vercel/analytics";
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
import {
  calculateSimilarity,
  getDailyPokemonId,
  getDailyShinyStatus,
  getGuessToastMessage,
  todayUtcDateString,
} from "@/lib/game/similarity";
import {
  computeGuessRelatedness,
  type GuessRelatedness,
} from "@/lib/game/relatedness";
import {
  getContrastTextClass,
  getContrastHex,
  getDimmedColor,
} from "@/lib/game/colors";
import {
  generateHints as buildGameHints,
  getGenerationFromId as getGenerationFromIdLib,
  type HintConfig,
} from "@/lib/game/hints";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoaderOverlay } from "@/components/loader-overlay";
import { POKEMON_CONSTANTS, FIRST_DAILY_GAME_DATE } from "@/constants/pokemon";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { Footer } from "@/components/footer";
import { CoffeeCTA } from "@/components/coffee-cta";
import {
  RefreshCw,
  Lightbulb,
  Flag,
  Sparkles,
  Search,
  Calendar,
  Infinity as InfinityIcon,
} from "lucide-react";
import { GameDateHeader } from "@/components/game-date-header";
import { GuessCard } from "@/components/guess-card";
import { AnimatedDotGrid } from "@/components/animated-dot-grid";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import Image from "next/image";
import Link from "next/link";

// Lazy-load the heaviest leaf components - they only render after user action
// or at end-of-game. Keeps the initial /game chunk smaller.
const GameResultDialog = dynamic(
  () =>
    import("@/components/game-result-dialog").then((m) => ({
      default: m.GameResultDialog,
    })),
  { ssr: false }
);
const UnlimitedModeSettingsDialog = dynamic(
  () =>
    import("@/components/unlimited-mode-settings").then((m) => ({
      default: m.UnlimitedModeSettingsDialog,
    })),
  { ssr: false }
);
const PokemonSearch = dynamic(
  () =>
    import("@/components/pokemon-search").then((m) => ({
      default: m.PokemonSearch,
    })),
  { ssr: false }
);
const GameLeaderboardSection = dynamic(
  () =>
    import("@/components/game-leaderboard-section").then((m) => ({
      default: m.GameLeaderboardSection,
    })),
  { ssr: false }
);

// gsap is ~70KB. Load it on demand rather than ship it in the initial /game
// chunk.
type GsapModule = typeof gsap;
let gsapPromise: Promise<GsapModule> | null = null;
function loadGsap(): Promise<GsapModule> {
  if (!gsapPromise) {
    gsapPromise = import("gsap").then((m) => m.gsap);
  }
  return gsapPromise;
}

// canvas-confetti is only used on a win.
type ConfettiFn = (options: Record<string, unknown>) => void;
let confettiPromise: Promise<ConfettiFn> | null = null;
function loadConfetti(): Promise<ConfettiFn> {
  if (!confettiPromise) {
    confettiPromise = import("canvas-confetti").then(
      (m) => m.default as unknown as ConfettiFn
    );
  }
  return confettiPromise;
}

type GameMode = "daily" | "unlimited";
type GameStatus = "playing" | "won" | "lost";

interface Guess {
  pokemonId: number;
  pokemonName: string;
  colors: string[];
  similarity: number;
  spriteUrl: string | null;
  // Relatedness flags help us tell the player *why* a wrong guess was warm
  // (shares a type with the target, in the same evolution family, etc).
  // Null while the target Pokemon's data hasn't loaded yet; the reload paths
  // below fill this in once both sides are available.
  relatedness?: GuessRelatedness | null;
}

// Local alias: keep old callsites working while all text-class lookups go
// through the shared helper.
const getTextColor = getContrastTextClass;

function getSpriteUrl(pokemon: Pokemon, shiny: boolean): string | null {
  if (typeof pokemon.artwork === "object" && "front" in pokemon.artwork) {
    if (shiny && pokemon.artwork.shiny) {
      return pokemon.artwork.shiny;
    }
    return pokemon.artwork.front || null;
  }
  return null;
}

type ShinyPreference = "both" | "shiny" | "normal";

interface UnlimitedModeSettings {
  shinyPreference: ShinyPreference;
  selectedGenerations: number[];
}

export default function GamePage() {
  const { user, isLoaded: userLoaded } = useUser();
  const allPokemonList = getAllPokemonMetadata();
  const [mode, setMode] = useState<GameMode>("daily");
  const [isShiny, setIsShiny] = useState<boolean | null>(null);
  const [unlimitedSettings, setUnlimitedSettings] =
    useState<UnlimitedModeSettings>({
      shinyPreference: "both",
      selectedGenerations: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    });

  // Wrap the setter so every change in unlimited filters gets recorded.
  // Lets us see which generation subsets and shiny preferences players
  // actually pick, which informs what we promote / default.
  const updateUnlimitedSettings = (next: UnlimitedModeSettings) => {
    track("unlimited_settings_changed", {
      shiny_preference: next.shinyPreference,
      generation_count: next.selectedGenerations.length,
      generations: next.selectedGenerations.sort((a, b) => a - b).join(","),
    });
    setUnlimitedSettings(next);
  };
  const [targetPokemonId, setTargetPokemonId] = useState<number | null>(null);
  const [targetPokemon, setTargetPokemon] = useState<Pokemon | null>(null);
  const [targetColors, setTargetColors] = useState<ColorWithFrequency[]>([]);
  const [allTargetColors, setAllTargetColors] = useState<ColorWithFrequency[]>(
    []
  ); // Store all extracted colors
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
  const [pendingAttempts, setPendingAttempts] = useState<any[]>([]);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [revealedHints, setRevealedHints] = useState<number[]>([]);
  const [hintCooldown, setHintCooldown] = useState(0); // Cooldown in seconds (0-5)
  const [showGameResultDialog, setShowGameResultDialog] = useState(false);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [showGiveUpDialog, setShowGiveUpDialog] = useState(false);
  const hintRefs = useRef<(HTMLDivElement | null)[]>([]);
  const guessRefs = useRef<(HTMLDivElement | null)[]>([]);
  const colorBarRef = useRef<HTMLDivElement | null>(null);
  const pokemonArtworkRef = useRef<HTMLDivElement | null>(null);
  const generatedHintsRef = useRef<string[]>([]); // Store generated hints to maintain consistency
  const hasAnimatedFullPaletteRef = useRef(false); // Track if we've animated the full palette expansion

  const MAX_ATTEMPTS = 4;

  const PENDING_ATTEMPTS_KEY = "pokemon-palette-pending-attempts";

  // Alias the shared helper locally so the existing getTextColor(...) call
  // sites don't all need to churn. The real implementation lives in
  // src/lib/game/colors.ts.
  const getTextColor = getContrastHex;

  // Get generation from Pokemon ID (since JSON data has incorrect generation)
  const getGenerationFromId = getGenerationFromIdLib;

  // Filter Pokemon list based on unlimited mode settings
  const pokemonList = useMemo(() => {
    if (mode === "daily") {
      return allPokemonList;
    }

    // Filter by generation
    const filtered = allPokemonList.filter((pokemon) => {
      const generation = getGenerationFromId(pokemon.id);
      return unlimitedSettings.selectedGenerations.includes(generation);
    });

    return filtered;
  }, [mode, allPokemonList, unlimitedSettings.selectedGenerations]);

  // Get available generations (1-9)
  const availableGenerations = useMemo(() => {
    const gens = new Set<number>();
    allPokemonList.forEach((pokemon) => {
      gens.add(getGenerationFromId(pokemon.id));
    });
    return Array.from(gens).sort((a, b) => a - b);
  }, [allPokemonList]);

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

      const dateStr = todayUtcDateString();

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
                    setAllTargetColors(colors); // Store all colors
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
                          relatedness: computeGuessRelatedness(
                            guessPokemon,
                            targetPokemonData
                          ),
                        };
                      }
                    );

                    const loadedGuesses = (
                      await Promise.all(guessesPromises)
                    ).filter((g): g is Guess => g !== null);
                    setGuesses(loadedGuesses);
                    setAttempts(todayAttempt.attempts);
                    const gameStatus = todayAttempt.won ? "won" : "lost";
                    setStatus(gameStatus);
                    // Show the result dialog if the game is already completed
                    setShowGameResultDialog(true);
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

      // Check API for signed-in users. Fetch stats in the same request so
      // we don't need a second round-trip on mount.
      try {
        const response = await fetch(
          `/api/daily-game-attempts?stats=true`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.stats) {
            setUserStats(data.stats);
          }
          const todayAttempt = (data.attempts || []).find(
            (a: any) => a.date === dateStr
          );
          if (todayAttempt) {

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
                  const allFallbackColors =
                    targetPokemonData.colorPalette?.highlights || [];
                  // Convert fallback colors to ColorWithFrequency format
                  const allFallbackWithFreq: ColorWithFrequency[] =
                    allFallbackColors.map((hex, idx) => ({
                      hex,
                      frequency: 100 - idx * 10, // Dummy frequencies for fallback
                      percentage:
                        ((100 - idx * 10) / allFallbackColors.length) * 100,
                    }));
                  setAllTargetColors(allFallbackWithFreq); // Store all colors
                  const fallbackColors = allFallbackWithFreq.slice(
                    0,
                    POKEMON_CONSTANTS.PALETTE_COLORS_COUNT
                  );
                  setTargetColors(fallbackColors);
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
                    relatedness: computeGuessRelatedness(
                      guessPokemon,
                      targetPokemonData
                    ),
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
              const gameStatus = todayAttempt.won ? "won" : "lost";
              setStatus(gameStatus);
              // Show the result dialog if the game is already completed
              setShowGameResultDialog(true);
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
    generatedHintsRef.current = [];
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

      // Determine shiny status for this game
      let gameShiny: boolean;
      if (mode === "daily") {
        gameShiny = getDailyShinyStatus(); // Deterministic for daily based on date
      } else {
        // Use settings for unlimited mode
        if (unlimitedSettings.shinyPreference === "shiny") {
          gameShiny = true;
        } else if (unlimitedSettings.shinyPreference === "normal") {
          gameShiny = false;
        } else {
          gameShiny = getRandomShiny(); // Random if "both"
        }
      }

      setIsShiny(gameShiny);

      let pokemonId: number;

      if (mode === "daily") {
        // Daily mode limited to Gen 1 Pokemon (IDs 1-151) for now
        pokemonId = getDailyPokemonId(151, gameShiny);
      } else {
        // Unlimited mode: choose from filtered list based on settings
        if (pokemonList.length === 0) {
          // Fallback if no Pokemon match filters
          const randomIndex = Math.floor(Math.random() * allPokemonList.length);
          pokemonId = allPokemonList[randomIndex].id;
        } else {
          const randomIndex = Math.floor(Math.random() * pokemonList.length);
          pokemonId = pokemonList[randomIndex].id;
        }
      }

      setTargetPokemonId(pokemonId);
      track("game_started", {
        mode,
        pokemon_id: pokemonId,
        is_shiny: gameShiny,
        generation: getGenerationFromId(pokemonId),
        is_signed_in: !!user,
      });
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
            setAllTargetColors(colors); // Store all colors
            const topColors = colors.slice(
              0,
              POKEMON_CONSTANTS.PALETTE_COLORS_COUNT
            );
            setTargetColors(topColors);
          } catch (error) {
            console.error("Failed to extract colors:", error);
            const allFallbackColors =
              pokemonData.colorPalette?.highlights || [];
            // Convert fallback colors to ColorWithFrequency format
            const allFallbackWithFreq: ColorWithFrequency[] =
              allFallbackColors.map((hex, idx) => ({
                hex,
                frequency: 100 - idx * 10, // Dummy frequencies for fallback
                percentage: ((100 - idx * 10) / allFallbackColors.length) * 100,
              }));
            setAllTargetColors(allFallbackWithFreq); // Store all colors
            const fallbackColors = allFallbackWithFreq.slice(
              0,
              POKEMON_CONSTANTS.PALETTE_COLORS_COUNT
            );
            setTargetColors(fallbackColors);
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
              const dateStr = todayUtcDateString();
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
  }, [mode, pokemonList.length, checkingAuth, unlimitedSettings]);

  // Trigger confetti on win with palette colors. We lazy-load the library so
  // it only enters the client bundle for players who actually win.
  useEffect(() => {
    if (status !== "won" || targetColors.length === 0) return;

    const colors = targetColors.map((c) => c.hex);
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

    let interval: NodeJS.Timeout | null = null;
    let cancelled = false;

    loadConfetti().then((confetti) => {
      if (cancelled) return;
      interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          if (interval) clearInterval(interval);
          return;
        }
        const particleCount = 50 * (timeLeft / duration);
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors,
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors,
        });
      }, 250);
    });

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [status, targetColors]);

  // Refresh user stats only after a game ends. The initial stats payload is
  // fetched together with today's attempt in `checkTodayAttempt` above, so
  // we don't need to hit the network on mount.
  useEffect(() => {
    if (mode !== "daily") {
      setUserStats(null);
      return;
    }
    if (!user) {
      setUserStats(null);
      return;
    }
    if (status === "playing") return;

    const fetchStats = async () => {
      try {
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
  }, [mode, user, status]);

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
    const relatedness = targetPokemon
      ? computeGuessRelatedness(guessedPokemon, targetPokemon)
      : null;
    const newGuess: Guess = {
      pokemonId,
      pokemonName: guessedMetadata.name,
      colors: guessColors,
      similarity,
      spriteUrl,
      relatedness,
    };

    const newAttempts = attempts + 1;
    const allGuesses = [...guesses, newGuess];
    setGuesses(allGuesses);
    setAttempts(newAttempts);

    // Check win condition
    const won = pokemonId === targetPokemonId;
    const lost = !won && newAttempts >= MAX_ATTEMPTS;

    track("guess_submitted", {
      mode,
      attempt_number: newAttempts,
      similarity: Math.round(similarity),
      is_correct: won,
      hints_used_so_far: revealedHints.length,
    });

    // Nudge the player when a wrong guess is still "warm" — same evolution
    // family or a shared type. The guess card also carries these labels, but
    // a short toast makes the feedback feel immediate and rewards near-misses
    // without giving away the answer.
    if (!won && !lost && relatedness) {
      if (relatedness.sameEvolutionFamily) {
        toast("Same evolution family — you're close!", {
          icon: "🧬",
          duration: 2500,
        });
      } else if (relatedness.sharedTypes.length > 0) {
        const typeLabel =
          relatedness.sharedTypes.length === 1
            ? relatedness.sharedTypes[0]
            : relatedness.sharedTypes.join(" / ");
        toast(`Same type: ${typeLabel}`, {
          icon: "🏷️",
          duration: 2500,
        });
      }
    }

    if (won) {
      setStatus("won");
      track("game_completed", {
        mode,
        outcome: "won",
        attempts: newAttempts,
        hints_used: revealedHints.length,
        is_shiny: isShiny === true,
        pokemon_id: targetPokemonId ?? 0,
        is_signed_in: !!user,
      });
      // Show toast before the dialog
      toast.success(
        <div className="text-center w-full" style={{ width: "100%" }}>
          {getGuessToastMessage(newAttempts)}
        </div>,
        {
          duration: 3000,
        }
      );
      // Small delay before showing dialog to let toast appear first
      setTimeout(() => {
        setShowGameResultDialog(true);
      }, 1500);
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
      track("game_completed", {
        mode,
        outcome: "lost",
        attempts: newAttempts,
        hints_used: revealedHints.length,
        is_shiny: isShiny === true,
        pokemon_id: targetPokemonId ?? 0,
        is_signed_in: !!user,
      });
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

    const dateStr = todayUtcDateString();

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
      const dateStr = todayUtcDateString();

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

      const successCount = results.filter(Boolean).length;
      if (successCount > 0) {
        track("pending_attempts_synced", {
          attempted: results.length,
          succeeded: successCount,
        });
      }

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

  // Wrap the shared generator so the in-component call sites don't need to
  // thread through mode/generation settings themselves.
  const generateHints = (pokemon: Pokemon): string[] => {
    const includeGeneration =
      mode === "daily" ||
      (mode === "unlimited" &&
        unlimitedSettings.selectedGenerations.length > 1);
    const hintConfig =
      ((pokemon as unknown) as { hintConfig?: HintConfig }).hintConfig ?? null;
    return buildGameHints(pokemon, { includeGeneration, hintConfig });
  };

  // Generate and store hints when target Pokemon, mode, or settings change
  useEffect(() => {
    if (targetPokemon) {
      generatedHintsRef.current = generateHints(targetPokemon);
    } else {
      generatedHintsRef.current = [];
    }
    // Reset revealed hints when Pokemon or settings change
    setRevealedHints([]);
    setHintCooldown(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetPokemon, mode, unlimitedSettings]);

  const showNextHint = () => {
    if (!targetPokemon || revealedHints.length >= 3 || hintCooldown > 0) return;
    const nextHintIndex = revealedHints.length;
    setRevealedHints([...revealedHints, nextHintIndex]);
    setHintCooldown(5); // Start 5 second cooldown
    track("hint_revealed", {
      hint_index: nextHintIndex,
      mode,
      attempts_so_far: attempts,
    });
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
    if (revealedHints.length === 0 || !targetPokemon) return;
    const lastRevealedIndex = revealedHints[revealedHints.length - 1];
    const hintElement = hintRefs.current[lastRevealedIndex];
    if (!hintElement) return;
    let cancelled = false;
    loadGsap().then((gsap) => {
      if (cancelled) return;
      gsap.set(hintElement, { opacity: 0, y: -20, scale: 0.8 });
      gsap.to(hintElement, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.5,
        ease: "back.out(1.7)",
      });
    });
    return () => {
      cancelled = true;
    };
  }, [revealedHints, targetPokemon]);

  // Animate guesses when they are added
  useEffect(() => {
    if (guesses.length === 0) return;
    const lastGuessIndex = guesses.length - 1;
    const guessElement = guessRefs.current[lastGuessIndex];
    if (!guessElement) return;
    let cancelled = false;
    loadGsap().then((gsap) => {
      if (cancelled) return;
      gsap.set(guessElement, { opacity: 0, x: 50, scale: 0.9 });
      gsap.to(guessElement, {
        opacity: 1,
        x: 0,
        scale: 1,
        duration: 0.6,
        ease: "power3.out",
      });
    });
    return () => {
      cancelled = true;
    };
  }, [guesses]);

  // Animate color bar when colors are loaded
  useEffect(() => {
    if (targetColors.length === 0 || !colorBarRef.current) return;
    const colorBar = colorBarRef.current;
    let cancelled = false;
    loadGsap().then((gsap) => {
      if (cancelled) return;
      const colorDivs = colorBar.querySelectorAll<HTMLElement>("div");
      gsap.set(colorDivs, { scaleX: 0, transformOrigin: "left center" });
      gsap.to(colorDivs, {
        scaleX: 1,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.1,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [targetColors]);

  // Animate full palette expansion when third hint is revealed
  useEffect(() => {
    if (
      !revealedHints.includes(2) ||
      allTargetColors.length <= targetColors.length ||
      !colorBarRef.current ||
      hasAnimatedFullPaletteRef.current
    ) {
      return;
    }
    hasAnimatedFullPaletteRef.current = true;
    let cancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled || !colorBarRef.current) return;
        const colorBar = colorBarRef.current;
        const allDivs = colorBar.querySelectorAll<HTMLElement>("div");
        if (allDivs.length <= targetColors.length) return;
        const newDivs = Array.from(allDivs).slice(targetColors.length);
        loadGsap().then((gsap) => {
          if (cancelled) return;
          gsap.set(newDivs, { scaleX: 0, transformOrigin: "left center" });
          gsap.to(newDivs, {
            scaleX: 1,
            duration: 0.8,
            ease: "power3.out",
            stagger: 0.1,
          });
        });
      });
    });
    return () => {
      cancelled = true;
    };
  }, [revealedHints, allTargetColors.length, targetColors.length]);

  // Reset animation flag when game resets or Pokemon changes
  useEffect(() => {
    hasAnimatedFullPaletteRef.current = false;
  }, [targetPokemonId]);

  // Animate Pokemon artwork with subtle wiggle every few seconds
  useEffect(() => {
    if (status === "playing" || !pokemonArtworkRef.current) return;
    const artworkElement = pokemonArtworkRef.current;
    let cancelled = false;
    let interval: NodeJS.Timeout | null = null;
    let initialTimeout: NodeJS.Timeout | null = null;
    let wiggleAnimation: gsap.core.Timeline | null = null;

    loadGsap().then((gsap) => {
      if (cancelled) return;
      wiggleAnimation = gsap.timeline({ paused: true });
      wiggleAnimation
        .to(artworkElement, {
          rotation: 4,
          scale: 1.05,
          y: -3,
          duration: 0.15,
          ease: "power2.out",
        })
        .to(artworkElement, {
          rotation: -4,
          scale: 0.98,
          y: 3,
          duration: 0.15,
          ease: "power2.inOut",
        })
        .to(artworkElement, {
          rotation: 2,
          scale: 1.02,
          y: -1,
          duration: 0.1,
          ease: "power2.out",
        })
        .to(artworkElement, {
          rotation: 0,
          scale: 1,
          y: 0,
          duration: 0.2,
          ease: "power2.inOut",
        });

      const triggerWiggle = () => {
        wiggleAnimation?.restart();
      };
      interval = setInterval(triggerWiggle, 2500);
      initialTimeout = setTimeout(triggerWiggle, 800);
    });

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (initialTimeout) clearTimeout(initialTimeout);
      wiggleAnimation?.kill();
    };
  }, [status, targetPokemon]);

  const handleGiveUp = () => {
    if (status !== "playing" || !targetPokemon) return;

    setStatus("lost");
    track("game_completed", {
      mode,
      outcome: "given_up",
      attempts,
      hints_used: revealedHints.length,
      is_shiny: isShiny === true,
      pokemon_id: targetPokemonId ?? 0,
      is_signed_in: !!user,
    });
    setShowGameResultDialog(true);
    setShowGiveUpDialog(false);

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

  const handleGuessWithDialog = (pokemonId: number) => {
    handleGuess(pokemonId);
    setShowSearchDialog(false);
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

    // Determine shiny status for this game
    let gameShiny: boolean;
    if (mode === "daily") {
      gameShiny = getDailyShinyStatus(); // Deterministic for daily based on date
    } else {
      // Use settings for unlimited mode
      if (unlimitedSettings.shinyPreference === "shiny") {
        gameShiny = true;
      } else if (unlimitedSettings.shinyPreference === "normal") {
        gameShiny = false;
      } else {
        gameShiny = getRandomShiny(); // Random if "both"
      }
    }

    setIsShiny(gameShiny);

    let pokemonId: number;
    if (mode === "daily") {
      // Daily mode limited to Gen 1 Pokemon (IDs 1-151) for now
      pokemonId = getDailyPokemonId(151, gameShiny);
    } else {
      // Unlimited mode: choose from filtered list based on settings
      if (pokemonList.length === 0) {
        // Fallback if no Pokemon match filters
        const randomIndex = Math.floor(Math.random() * allPokemonList.length);
        pokemonId = allPokemonList[randomIndex].id;
      } else {
        const randomIndex = Math.floor(Math.random() * pokemonList.length);
        pokemonId = pokemonList[randomIndex].id;
      }
    }

    setTargetPokemonId(pokemonId);
    track("game_started", {
      mode,
      pokemon_id: pokemonId,
      is_shiny: gameShiny,
      generation: getGenerationFromId(pokemonId),
      is_signed_in: !!user,
      from_reset: true,
    });
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
          setAllTargetColors(colors); // Store all colors
          const topColors = colors.slice(
            0,
            POKEMON_CONSTANTS.PALETTE_COLORS_COUNT
          );
          setTargetColors(topColors);
        } catch (error) {
          console.error("Failed to extract colors:", error);
          const allFallbackColors = pokemonData.colorPalette?.highlights || [];
          // Convert fallback colors to ColorWithFrequency format
          const allFallbackWithFreq: ColorWithFrequency[] =
            allFallbackColors.map((hex, idx) => ({
              hex,
              frequency: 100 - idx * 10, // Dummy frequencies for fallback
              percentage: ((100 - idx * 10) / allFallbackColors.length) * 100,
            }));
          setAllTargetColors(allFallbackWithFreq); // Store all colors
          const fallbackColors = allFallbackWithFreq.slice(
            0,
            POKEMON_CONSTANTS.PALETTE_COLORS_COUNT
          );
          setTargetColors(fallbackColors);
        }
      }
    }

    setLoading(false);
  };

  return (
    <main id="main" className="flex h-screen overflow-hidden">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes shine {
              0%, 85% {
                transform: translateX(-100%);
              }
              95% {
                transform: translateX(100%);
              }
              100% {
                transform: translateX(100%);
              }
            }

            .shine-animation {
              animation: shine 6s ease-in-out infinite;
              animation-delay: 3s;
            }

            @media (prefers-reduced-motion: reduce) {
              .shine-animation {
                animation: none;
              }
            }
          `,
        }}
      />
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
        {/* Animated dot grid background */}
        <AnimatedDotGrid colors={targetColors} />

        <LoaderOverlay
          loading={checkingAuth || loading}
          text={checkingAuth ? "Checking authentication..." : "Loading game..."}
        />

        <div className="w-full max-w-4xl mx-auto p-4 md:p-8 flex flex-col items-center justify-start gap-6 md:gap-8 flex-1 relative z-10 pt-8 md:pt-8">
          <h1 className="text-3xl md:text-4xl font-bold text-center mb-6 mt-8 md:mt-12 font-heading px-4 md:px-0">
            {mode === "daily" ? "Daily Game" : "Unlimited Mode"}
          </h1>

          {/* Game Number, Date, and Mode Selection */}
          <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <GameDateHeader mode={mode} />
            <div className="flex-shrink-0">
              <Tabs
                value={mode}
                onValueChange={(value) => {
                  const newMode = value as GameMode;
                  if (newMode === mode) return;
                  track("mode_switched", { from: mode, to: newMode });
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
                <TabsList className="grid grid-cols-2 font-heading">
                  <TabsTrigger
                    value="daily"
                    className="cursor-pointer font-heading data-[state=active]:text-white data-[state=active]:dark:text-white"
                    style={
                      mode === "daily" &&
                      targetColors.length > 0 &&
                      targetColors[0]?.hex
                        ? {
                            backgroundColor: targetColors[0].hex,
                            color: getTextColor(targetColors[0].hex),
                          }
                        : undefined
                    }
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Daily
                  </TabsTrigger>
                  <TabsTrigger
                    value="unlimited"
                    className="cursor-pointer font-heading data-[state=active]:text-white data-[state=active]:dark:text-white"
                    style={
                      mode === "unlimited" &&
                      targetColors.length > 0 &&
                      targetColors[0]?.hex
                        ? {
                            backgroundColor: targetColors[0].hex,
                            color: getTextColor(targetColors[0].hex),
                          }
                        : undefined
                    }
                  >
                    <InfinityIcon className="w-4 h-4 mr-2" />
                    Unlimited
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {/* Target Palette Display */}
          {targetColors.length > 0 && (
            <div className="mb-6 w-full max-w-6xl rounded-lg border bg-card shadow-none relative overflow-hidden">
              {/* Color bar - at the top, outside padding */}
              <div
                ref={(el) => {
                  colorBarRef.current = el;
                }}
                className="relative z-10 w-full flex h-24 md:h-32 overflow-hidden"
              >
                {(() => {
                  // Show all colors if third hint is revealed and we have more colors available
                  const shouldShowFullPalette =
                    revealedHints.includes(2) &&
                    allTargetColors.length > targetColors.length;
                  const colorsToShow = shouldShowFullPalette
                    ? allTargetColors
                    : targetColors;

                  // Normalize percentages to sum to 100% while maintaining proportions
                  const totalPercentage = colorsToShow.reduce(
                    (sum, color) => sum + color.percentage,
                    0
                  );
                  const normalizedColors = colorsToShow.map((color) => ({
                    ...color,
                    normalizedPercentage:
                      totalPercentage > 0
                        ? (color.percentage / totalPercentage) * 100
                        : 100 / colorsToShow.length,
                  }));

                  return normalizedColors.map((color, index) => (
                    <div
                      key={index}
                      className="h-full flex items-center justify-center"
                      style={{
                        backgroundColor: color.hex,
                        width: `${color.normalizedPercentage}%`,
                      }}
                      title={`${color.hex} - ${color.percentage.toFixed(1)}%`}
                    />
                  ));
                })()}

                {/* Shiny Badge - Top Right Corner */}
                {isShiny === true && (
                  <div className="absolute top-2 right-2 md:top-3 md:right-3 z-20">
                    <Badge
                      variant="default"
                      className="border-transparent font-heading"
                      style={{
                        backgroundColor:
                          targetColors.length > 0
                            ? targetColors[0].hex
                            : undefined,
                        color:
                          targetColors.length > 0 && targetColors[0].hex
                            ? getTextColor(targetColors[0].hex)
                            : undefined,
                      }}
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      Shiny
                    </Badge>
                  </div>
                )}
              </div>

              {/* Content with padding */}
              <div className="relative z-10 p-4 md:p-6">
                <div className="flex items-start justify-end gap-4">
                  <div className="flex items-end gap-2">
                    {/* Hints Display - Left side of button when button is visible, or right-aligned when all hints revealed */}
                    {status === "playing" &&
                      targetPokemon &&
                      revealedHints.length > 0 && (
                        <div className="flex flex-col gap-2 items-end">
                          {revealedHints.map((hintIndex) => {
                            const hints =
                              generatedHintsRef.current.length > 0
                                ? generatedHintsRef.current
                                : generateHints(targetPokemon);
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
                                  variant="outline"
                                  className="border-2 rounded-full h-7 px-3 flex items-center"
                                  style={{
                                    borderColor: primaryColor || undefined,
                                    backgroundColor: primaryColor
                                      ? getDimmedColor(primaryColor, 0.15)
                                      : undefined,
                                    color: primaryColor || undefined,
                                  }}
                                >
                                  {hints[hintIndex]}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    {status === "playing" && targetPokemon && revealedHints.length < 3 && (
                      <Button
                        onClick={showNextHint}
                        variant="outline"
                        size="sm"
                        disabled={revealedHints.length >= 3 || hintCooldown > 0}
                        className="text-xs relative overflow-hidden cursor-pointer"
                      >
                        {/* Progress bar background */}
                        {hintCooldown > 0 && (
                          <div
                            className="absolute inset-y-0 left-0 bg-primary opacity-30 transition-all duration-1000 ease-linear"
                            style={{
                              width: `${((5 - hintCooldown) / 5) * 100}%`,
                              borderRadius: "inherit",
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

                {/* Pokemon artwork and info when game is finished */}
                {status !== "playing" && targetPokemon && (
                  <div className="mt-6 flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8">
                    {/* Pokemon Artwork */}
                    <div
                      ref={pokemonArtworkRef}
                      className="relative flex-shrink-0"
                    >
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
                        width={400}
                        height={400}
                        className="w-auto h-48 md:h-64 object-contain"
                        unoptimized
                      />
                    </div>

                    {/* Pokemon Info */}
                    <div className="flex flex-col gap-2 text-center md:text-left">
                      <h3 className="text-2xl md:text-3xl font-bold font-heading">
                        {targetPokemon.name}
                        {isShiny === true && (
                          <Badge
                            variant="default"
                            className="ml-2 font-heading"
                            style={{
                              backgroundColor:
                                targetColors.length > 0
                                  ? targetColors[0].hex
                                  : undefined,
                              color:
                                targetColors.length > 0 && targetColors[0].hex
                                  ? getTextColor(targetColors[0].hex)
                                  : undefined,
                            }}
                          >
                            <Sparkles className="w-3 h-3 mr-1" />
                            Shiny
                          </Badge>
                        )}
                      </h3>
                      <p className="text-muted-foreground">
                        {targetPokemon.species.toLowerCase().startsWith("the")
                          ? targetPokemon.species
                          : `The ${targetPokemon.species}`}
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center md:justify-start mt-2">
                        {targetPokemon.type.map((type, index) => (
                          <Badge
                            key={type}
                            className="font-medium"
                            style={{
                              backgroundColor:
                                targetColors[index % targetColors.length]
                                  ?.hex || targetColors[0]?.hex,
                              color:
                                targetColors[index % targetColors.length]
                                  ?.hex || targetColors[0]?.hex
                                  ? getTextColor(
                                      targetColors[index % targetColors.length]
                                        ?.hex || targetColors[0]?.hex
                                    )
                                  : undefined,
                            }}
                          >
                            {type}
                          </Badge>
                        ))}
                      </div>
                      <div className="text-sm text-muted-foreground mt-2">
                        #{targetPokemon.id.toString().padStart(3, "0")} •
                        Generation {getGenerationFromId(targetPokemon.id)}
                      </div>
                      <Link
                        href={`/${targetPokemon.name.toLowerCase()}`}
                        className="mt-4"
                        onClick={() =>
                          track("explore_palette_clicked", {
                            placement: "game_page_inline",
                            pokemon_id: targetPokemon.id,
                            mode,
                            status,
                          })
                        }
                      >
                        <Button
                          variant="default"
                          className="w-full md:w-auto cursor-pointer font-medium font-heading transition-all duration-300 hover:scale-105 active:scale-95 relative overflow-hidden group"
                          style={{
                            backgroundColor:
                              targetColors.length > 0
                                ? targetColors[0].hex
                                : undefined,
                            color:
                              targetColors.length > 0 && targetColors[0].hex
                                ? getTextColor(targetColors[0].hex)
                                : undefined,
                            borderColor:
                              targetColors.length > 0
                                ? targetColors[0].hex
                                : undefined,
                          }}
                        >
                          {/* Hover shine animation overlay */}
                          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                          {/* Automatic shine animation overlay */}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none shine-animation" />

                          <Sparkles className="w-4 h-4 mr-2 relative z-10" />
                          <span className="relative z-10">
                            Explore {targetPokemon.name}&apos;s palette
                          </span>
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-between items-center mt-4">
                  <div className="flex items-center gap-2">
                    {status === "playing" && (
                      <>
                        <Button
                          onClick={() => setShowGiveUpDialog(true)}
                          variant="outline"
                          className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-300 dark:border-red-700 cursor-pointer"
                        >
                          <Flag className="w-4 h-4 mr-2" />
                          Give Up
                        </Button>
                        <AlertDialog
                          open={showGiveUpDialog}
                          onOpenChange={setShowGiveUpDialog}
                        >
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to give up? This will end
                                the game and reveal the answer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="cursor-pointer">
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={handleGiveUp}
                                className="bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                              >
                                Give Up
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                    {mode === "unlimited" && (
                      <UnlimitedModeSettingsDialog
                        settings={unlimitedSettings}
                        onSettingsChange={updateUnlimitedSettings}
                        availableGenerations={availableGenerations}
                      />
                    )}
                  </div>
                  <div>
                    {mode === "unlimited" && (
                      <Button
                        onClick={resetGame}
                        variant="outline"
                        disabled={loading}
                        className="cursor-pointer"
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
              targetColors={targetColors}
              unlimitedSettings={
                mode === "unlimited" ? unlimitedSettings : undefined
              }
              onUnlimitedSettingsChange={
                mode === "unlimited" ? updateUnlimitedSettings : undefined
              }
              availableGenerations={
                mode === "unlimited" ? availableGenerations : undefined
              }
              userStats={mode === "daily" ? userStats : undefined}
              guesses={guesses}
              attempts={attempts}
              hintsUsed={revealedHints.length}
            />
          )}

          {/* Two Column Layout: Search (Left) and Guesses (Right) - 50/50 Split */}
          <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Search */}
            <div className="lg:col-span-1">
              <div className="space-y-3 p-4 md:p-6">
                {status === "playing" ? (
                  <>
                    {/* Desktop: Show search directly */}
                    <div className="hidden lg:block">
                      <PokemonSearch
                        pokemonList={allPokemonList}
                        selectedPokemon={null}
                        onPokemonSelect={handleGuess}
                        isShiny={isShiny === true}
                        guessedPokemonIds={guesses.map((g) => g.pokemonId)}
                        selectedGenerations={
                          mode === "unlimited"
                            ? unlimitedSettings.selectedGenerations
                            : undefined
                        }
                        placeholder="Enter Pokemon name or number..."
                      />
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        💡 Tip: Search works in multiple languages (日本語,
                        Français, Deutsch, Español, and more!)
                      </p>
                    </div>
                    {/* Mobile: Show button to open dialog */}
                    <div className="lg:hidden">
                      <Button
                        onClick={() => setShowSearchDialog(true)}
                        className="w-full cursor-pointer"
                        variant="outline"
                      >
                        <Search className="w-4 h-4 mr-2" />
                        Search Pokemon
                      </Button>
                      <Dialog
                        open={showSearchDialog}
                        onOpenChange={setShowSearchDialog}
                      >
                        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Search Pokemon</DialogTitle>
                          </DialogHeader>
                          <div className="mt-4">
                            <PokemonSearch
                              pokemonList={allPokemonList}
                              selectedPokemon={null}
                              onPokemonSelect={handleGuessWithDialog}
                              isShiny={isShiny === true}
                              guessedPokemonIds={guesses.map(
                                (g) => g.pokemonId
                              )}
                              selectedGenerations={
                                mode === "unlimited"
                                  ? unlimitedSettings.selectedGenerations
                                  : undefined
                              }
                              placeholder="Enter Pokemon name or number..."
                            />
                            <p className="text-xs text-muted-foreground mt-2 text-center">
                              💡 Tip: Search works in multiple languages
                              (日本語, Français, Deutsch, Español, and more!)
                            </p>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {loadingGuess && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Analyzing guess...
                      </p>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col justify-center min-h-[400px] rounded-lg border bg-card">
                    <div className="space-y-4 px-4">
                      <p className="text-sm text-muted-foreground text-center">
                        Want to keep playing? Try unlimited mode with random
                        Pokemon!
                      </p>
                      <Button
                        onClick={async () => {
                          // Reset all game state first
                          setGuesses([]);
                          setAttempts(0);
                          setStatus("playing");
                          setRevealedHints([]);
                          setHintCooldown(0);
                          setTargetPokemon(null);
                          setTargetPokemonId(null);
                          setTargetColors([]);
                          setAllTargetColors([]);
                          generatedHintsRef.current = [];
                          // Switch to unlimited mode
                          setMode("unlimited");
                          // Initialize new game in unlimited mode
                          setLoading(true);

                          // Determine shiny status for unlimited mode
                          let gameShiny: boolean;
                          if (unlimitedSettings.shinyPreference === "shiny") {
                            gameShiny = true;
                          } else if (
                            unlimitedSettings.shinyPreference === "normal"
                          ) {
                            gameShiny = false;
                          } else {
                            gameShiny = getRandomShiny();
                          }
                          setIsShiny(gameShiny);

                          // Get filtered Pokemon list for unlimited mode
                          const filteredPokemonList = allPokemonList.filter(
                            (p) => {
                              const generation = getGenerationFromId(p.id);
                              return unlimitedSettings.selectedGenerations.includes(
                                generation
                              );
                            }
                          );

                          // Choose random Pokemon
                          let pokemonId: number;
                          if (filteredPokemonList.length === 0) {
                            const randomIndex = Math.floor(
                              Math.random() * allPokemonList.length
                            );
                            pokemonId = allPokemonList[randomIndex].id;
                          } else {
                            const randomIndex = Math.floor(
                              Math.random() * filteredPokemonList.length
                            );
                            pokemonId = filteredPokemonList[randomIndex].id;
                          }

                          setTargetPokemonId(pokemonId);
                          const pokemonData = await getPokemonById(pokemonId);

                          if (pokemonData) {
                            setTargetPokemon(pokemonData);
                            const spriteUrl = getSpriteUrl(
                              pokemonData,
                              gameShiny
                            );
                            if (spriteUrl) {
                              try {
                                const colors = (await extractColorsFromImage(
                                  spriteUrl,
                                  POKEMON_CONSTANTS.COLORS_TO_EXTRACT,
                                  true
                                )) as ColorWithFrequency[];
                                setAllTargetColors(colors); // Store all colors
                                const topColors = colors.slice(
                                  0,
                                  POKEMON_CONSTANTS.PALETTE_COLORS_COUNT
                                );
                                setTargetColors(topColors);
                              } catch (error) {
                                console.error(
                                  "Failed to extract colors:",
                                  error
                                );
                                const allFallbackColors =
                                  pokemonData.colorPalette?.highlights || [];
                                const allFallbackWithFreq: ColorWithFrequency[] =
                                  allFallbackColors.map((hex, idx) => ({
                                    hex,
                                    frequency: 100 - idx * 10,
                                    percentage:
                                      ((100 - idx * 10) /
                                        allFallbackColors.length) *
                                      100,
                                  }));
                                setAllTargetColors(allFallbackWithFreq); // Store all colors
                                const fallbackColors =
                                  allFallbackWithFreq.slice(
                                    0,
                                    POKEMON_CONSTANTS.PALETTE_COLORS_COUNT
                                  );
                                setTargetColors(fallbackColors);
                              }
                            }
                          }
                          setLoading(false);
                        }}
                        className="w-full cursor-pointer"
                      >
                        <InfinityIcon className="w-4 h-4 mr-2" />
                        Play Unlimited Mode
                      </Button>
                    </div>
                  </div>
                )}

                {/* Game Rules Panel - Show when playing or game hasn't started, hide when game has ended */}
                {status !== "won" && status !== "lost" && (
                  <Card className="mt-4">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        How to Play
                      </CardTitle>
                      <CardDescription>
                        Guess the Pokemon based on its color palette
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-start gap-2">
                          <span className="text-muted-foreground mt-0.5">
                            •
                          </span>
                          <span>
                            You have <strong>{MAX_ATTEMPTS} attempts</strong> to
                            guess the correct Pokemon
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-muted-foreground mt-0.5">
                            •
                          </span>
                          <span>
                            Use the color palette at the top to identify the
                            Pokemon
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-muted-foreground mt-0.5">
                            •
                          </span>
                          <span>
                            After each guess, you&apos;ll see how similar your
                            guess is to the target
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-muted-foreground mt-0.5">
                            •
                          </span>
                          <span>
                            Use hints to narrow down your options (up to 3 hints
                            available)
                          </span>
                        </li>
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Right Column: Previous Guesses */}
            <div className="lg:col-span-1">
              <div className="space-y-3 p-4 md:p-6">
                <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto">
                  {Array.from({ length: MAX_ATTEMPTS }).map((_, index) => {
                    const guess = guesses[index];
                    const isCorrect =
                      guess && guess.pokemonId === targetPokemonId;
                    return guess ? (
                      <GuessCard
                        key={index}
                        guess={guess}
                        index={index}
                        isCorrect={isCorrect || false}
                        onRef={(el) => {
                          guessRefs.current[index] = el;
                        }}
                      />
                    ) : (
                      <div
                        key={index}
                        ref={(el) => {
                          guessRefs.current[index] = el;
                        }}
                        className="flex items-center gap-4 p-3 rounded-lg border bg-card/50 opacity-50 flex-shrink-0"
                      >
                        {/* Empty placeholder - Image */}
                        <div className="relative flex-shrink-0 w-16 h-16 bg-muted rounded" />

                        {/* Empty placeholder - Name and Match */}
                        <div className="flex-1 min-w-0">
                          <div className="h-4 bg-muted rounded mb-2 w-24" />
                          <div className="h-3 bg-muted rounded w-16" />
                        </div>

                        {/* Empty placeholder - Colors */}
                        <div className="flex gap-1.5 items-center flex-shrink-0">
                          {Array.from({ length: 3 }).map((_, colorIndex) => (
                            <div
                              key={colorIndex}
                              className="h-10 w-10 rounded-md border-2 bg-muted"
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Leaderboard - daily mode only. Edge-cached via /api so viral
              traffic hits the origin at most once per minute per sort. */}
          {mode === "daily" && <GameLeaderboardSection />}
        </div>
        <Footer />
      </div>
    </main>
  );
}
