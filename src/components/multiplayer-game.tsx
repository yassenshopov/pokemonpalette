"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { useUser } from "@clerk/nextjs";
import { SignInButton } from "@clerk/nextjs";
import { toast } from "sonner";
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
import { calculateSimilarity } from "@/lib/game/similarity";
import {
  computeGuessRelatedness,
  type GuessRelatedness,
} from "@/lib/game/relatedness";
import { getDimmedColor } from "@/lib/game/colors";
import {
  generateHints as buildGameHints,
  type HintConfig,
} from "@/lib/game/hints";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { POKEMON_CONSTANTS } from "@/constants/pokemon";
import {
  Lightbulb,
  Flag,
  Sparkles,
  Search,
  LogIn,
  Users,
} from "lucide-react";
import { GuessCard } from "@/components/guess-card";
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
import { useMultiplayer } from "@/hooks/use-multiplayer";
import {
  MultiplayerLobby,
  WaitingRoom,
} from "@/components/multiplayer-lobby";
import { OpponentStatus } from "@/components/multiplayer-opponent-status";
import { LoaderOverlay } from "@/components/loader-overlay";

const MultiplayerResultDialog = dynamic(
  () =>
    import("@/components/multiplayer-result-dialog").then((m) => ({
      default: m.MultiplayerResultDialog,
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

type GameStatus = "playing" | "won" | "lost";

interface Guess {
  pokemonId: number;
  pokemonName: string;
  colors: string[];
  similarity: number;
  spriteUrl: string | null;
  relatedness?: GuessRelatedness | null;
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

const MAX_ATTEMPTS = 4;

export function MultiplayerGame() {
  const { user, isLoaded: userLoaded } = useUser();
  const allPokemonList = getAllPokemonMetadata();

  const mp = useMultiplayer(user?.id);

  const [targetPokemon, setTargetPokemon] = useState<Pokemon | null>(null);
  const [targetColors, setTargetColors] = useState<ColorWithFrequency[]>([]);
  const [allTargetColors, setAllTargetColors] = useState<ColorWithFrequency[]>(
    []
  );
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [localStatus, setLocalStatus] = useState<GameStatus>("playing");
  const [loadingGuess, setLoadingGuess] = useState(false);
  const [loadingPokemon, setLoadingPokemon] = useState(false);
  const [revealedHints, setRevealedHints] = useState<number[]>([]);
  const [hintCooldown, setHintCooldown] = useState(0);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [showGiveUpDialog, setShowGiveUpDialog] = useState(false);

  const generatedHintsRef = useRef<string[]>([]);
  const guessRefs = useRef<(HTMLDivElement | null)[]>([]);
  const colorBarRef = useRef<HTMLDivElement | null>(null);
  const hintRefs = useRef<(HTMLDivElement | null)[]>([]);

  const currentPlayer = useMemo(() => {
    if (!user?.id) return null;
    return mp.players.find((p) => p.userId === user.id) ?? null;
  }, [mp.players, user?.id]);

  const opponent = useMemo(() => {
    if (!user?.id) return null;
    return mp.players.find((p) => p.userId !== user.id) ?? null;
  }, [mp.players, user?.id]);

  // Load target Pokemon palette when room exists (waiting, playing, or finished).
  useEffect(() => {
    if (
      mp.status !== "waiting" &&
      mp.status !== "playing" &&
      mp.status !== "finished"
    )
      return;
    if (!mp.roomCode) return;
    if (targetPokemon) return;

    const loadTarget = async () => {
      setLoadingPokemon(true);
      try {
        const paletteRes = await fetch(
          `/api/multiplayer/rooms/${mp.roomCode}/palette`
        );
        if (!paletteRes.ok) return;
        const paletteData = await paletteRes.json();

        const pokemonData = await getPokemonById(paletteData.pokemonId);
        if (!pokemonData) return;

        setTargetPokemon(pokemonData);
        const spriteUrl = getSpriteUrl(pokemonData, paletteData.isShiny);
        if (spriteUrl) {
          try {
            const colors = (await extractColorsFromImage(
              spriteUrl,
              POKEMON_CONSTANTS.COLORS_TO_EXTRACT,
              true
            )) as ColorWithFrequency[];
            setAllTargetColors(colors);
            setTargetColors(
              colors.slice(0, POKEMON_CONSTANTS.PALETTE_COLORS_COUNT)
            );
          } catch {
            const fallback =
              pokemonData.colorPalette?.highlights?.map((hex, idx) => ({
                hex,
                frequency: 100 - idx * 10,
                percentage:
                  100 / (pokemonData.colorPalette?.highlights?.length ?? 1),
              })) ?? [];
            setAllTargetColors(fallback);
            setTargetColors(
              fallback.slice(0, POKEMON_CONSTANTS.PALETTE_COLORS_COUNT)
            );
          }
        }
      } catch (err) {
        console.error("Failed to load target:", err);
      } finally {
        setLoadingPokemon(false);
      }
    };

    loadTarget();
  }, [mp.status, mp.roomCode, targetPokemon]);

  // When game finishes via opponent, load the reveal
  useEffect(() => {
    if (mp.status !== "finished" || !mp.targetPokemonId) return;
    if (targetPokemon && targetPokemon.id === mp.targetPokemonId) return;

    const loadReveal = async () => {
      const pokemonData = await getPokemonById(mp.targetPokemonId!);
      if (pokemonData) {
        setTargetPokemon(pokemonData);
      }
    };
    loadReveal();
  }, [mp.status, mp.targetPokemonId, targetPokemon]);

  useEffect(() => {
    if (mp.status === "finished") {
      setShowResultDialog(true);
    }
  }, [mp.status]);

  useEffect(() => {
    if (targetPokemon) {
      const hintConfig =
        ((targetPokemon as unknown) as { hintConfig?: HintConfig })
          .hintConfig ?? null;
      generatedHintsRef.current = buildGameHints(targetPokemon, {
        includeGeneration: true,
        hintConfig,
      });
    } else {
      generatedHintsRef.current = [];
    }
    setRevealedHints([]);
    setHintCooldown(0);
  }, [targetPokemon]);

  useEffect(() => {
    if (hintCooldown <= 0) return;
    const interval = setInterval(() => {
      setHintCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [hintCooldown]);

  const showNextHint = () => {
    if (!targetPokemon || revealedHints.length >= 3 || hintCooldown > 0)
      return;
    const nextHintIndex = revealedHints.length;
    setRevealedHints([...revealedHints, nextHintIndex]);
    setHintCooldown(5);
  };

  const handleGuess = async (pokemonId: number) => {
    if (localStatus !== "playing" || loadingGuess) return;
    if (guesses.some((g) => g.pokemonId === pokemonId)) return;

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

    const spriteUrl = getSpriteUrl(guessedPokemon, mp.isShiny);
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
      } catch {
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

    const allGuesses = [...guesses, newGuess];
    const newAttempts = attempts + 1;
    setGuesses(allGuesses);
    setAttempts(newAttempts);

    const result = await mp.submitGuess(pokemonId, similarity);

    if (result) {
      if (result.correct) {
        setLocalStatus("won");
        toast.success("You got it!", { duration: 3000 });
      } else if (result.finished) {
        setLocalStatus("lost");
      } else if (relatedness) {
        if (relatedness.sameEvolutionFamily) {
          toast("Same evolution family \u2014 you\u2019re close!", {
            icon: "\uD83E\uDDEC",
            duration: 2500,
          });
        } else if (relatedness.sharedTypes.length > 0) {
          const typeLabel =
            relatedness.sharedTypes.length === 1
              ? relatedness.sharedTypes[0]
              : relatedness.sharedTypes.join(" / ");
          toast(`Same type: ${typeLabel}`, {
            icon: "\uD83C\uDFF7\uFE0F",
            duration: 2500,
          });
        }
      }
    }

    setLoadingGuess(false);
  };

  const handleGiveUp = async () => {
    setLocalStatus("lost");
    setShowGiveUpDialog(false);
    await mp.giveUp();
  };

  const handleGuessWithDialog = (pokemonId: number) => {
    handleGuess(pokemonId);
    setShowSearchDialog(false);
  };

  const resetForNewGame = () => {
    setTargetPokemon(null);
    setTargetColors([]);
    setAllTargetColors([]);
    setGuesses([]);
    setAttempts(0);
    setLocalStatus("playing");
    setRevealedHints([]);
    setHintCooldown(0);
    generatedHintsRef.current = [];
    mp.leaveRoom();
  };

  if (!userLoaded) {
    return <LoaderOverlay loading text="Loading…" />;
  }

  if (!user) {
    return (
      <div className="w-full max-w-md mx-auto mt-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl font-heading flex items-center justify-center gap-2">
              <Users className="w-5 h-5" aria-hidden="true" />
              Sign In Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground text-center text-pretty">
              You need to be signed in to play multiplayer mode.
            </p>
            <SignInButton mode="modal">
              <Button className="w-full cursor-pointer" size="lg">
                <LogIn className="w-4 h-4 mr-2" aria-hidden="true" />
                Sign In to Play
              </Button>
            </SignInButton>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mp.status === "idle") {
    return (
      <MultiplayerLobby
        onCreateRoom={mp.createRoom}
        onJoinRoom={mp.joinRoom}
        loading={mp.loading}
        error={mp.error}
      />
    );
  }

  if (mp.status === "waiting" && !targetColors.length) {
    return (
      <WaitingRoom roomCode={mp.roomCode!} onCancel={mp.leaveRoom} />
    );
  }

  const myPlayerFinished =
    mp.players.find((p) => p.userId === user.id)?.finished ?? false;
  const gameActive =
    (mp.status === "playing" || mp.status === "waiting") &&
    localStatus === "playing" &&
    !myPlayerFinished;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <LoaderOverlay loading={loadingPokemon} text="Loading game…" />

      {/* Room code + live indicator */}
      <div className="flex items-center justify-center gap-2">
        <Badge
          variant="outline"
          className="text-sm font-mono tracking-wider px-3 py-1"
        >
          Room: {mp.roomCode}
        </Badge>
        {mp.status === "playing" && (
          <Badge variant="secondary" className="text-xs">
            <Users className="w-3 h-3 mr-1" aria-hidden="true" />
            Live
          </Badge>
        )}
        {mp.status === "waiting" && (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            Waiting for opponent{"…"}
          </Badge>
        )}
      </div>

      {/* Target Palette */}
      {targetColors.length > 0 && (
        <div className="w-full rounded-lg border bg-card relative overflow-hidden">
          <div
            ref={colorBarRef}
            className="relative z-10 w-full flex h-24 md:h-32 overflow-hidden"
          >
            {(() => {
              const shouldShowFullPalette =
                revealedHints.includes(2) &&
                allTargetColors.length > targetColors.length;
              const colorsToShow = shouldShowFullPalette
                ? allTargetColors
                : targetColors;
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
                  className="h-full"
                  style={{
                    backgroundColor: color.hex,
                    width: `${color.normalizedPercentage}%`,
                  }}
                  title={`${color.hex} \u2013 ${color.percentage.toFixed(1)}%`}
                />
              ));
            })()}

            {mp.isShiny && (
              <div className="absolute top-2 right-2 z-20">
                <Badge variant="default" className="font-heading">
                  <Sparkles className="w-3 h-3 mr-1" aria-hidden="true" />
                  Shiny
                </Badge>
              </div>
            )}
          </div>

          <div className="relative z-10 p-4 md:p-6">
            {/* Hints */}
            <div className="flex items-start justify-end gap-4">
              <div className="flex items-end gap-2">
                {gameActive &&
                  targetPokemon &&
                  revealedHints.length > 0 && (
                    <div className="flex flex-col gap-2 items-end">
                      {revealedHints.map((hintIndex) => {
                        const hints = generatedHintsRef.current;
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
                {gameActive &&
                  targetPokemon &&
                  revealedHints.length < 3 && (
                    <Button
                      onClick={showNextHint}
                      variant="outline"
                      size="sm"
                      disabled={
                        revealedHints.length >= 3 || hintCooldown > 0
                      }
                      className="text-xs relative overflow-hidden cursor-pointer"
                      aria-label={`Reveal hint ${revealedHints.length + 1} of 3`}
                    >
                      {hintCooldown > 0 && (
                        <div
                          className="absolute inset-y-0 left-0 bg-primary opacity-30 transition-[width] duration-1000 ease-linear"
                          style={{
                            width: `${((5 - hintCooldown) / 5) * 100}%`,
                            borderRadius: "inherit",
                          }}
                        />
                      )}
                      <Lightbulb className="w-3 h-3 mr-1.5 relative z-10" aria-hidden="true" />
                      <span className="relative z-10">
                        {revealedHints.length === 0
                          ? "Show Me a Hint"
                          : revealedHints.length === 1
                          ? "Show Another Hint"
                          : "Show Final Hint"}
                      </span>
                    </Button>
                  )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-between items-center mt-4">
              <div>
                {gameActive && (
                  <>
                    <Button
                      onClick={() => setShowGiveUpDialog(true)}
                      variant="outline"
                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-300 dark:border-red-700 cursor-pointer"
                    >
                      <Flag className="w-4 h-4 mr-2" aria-hidden="true" />
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
                            Giving up ends your turn. Your opponent will
                            continue playing.
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
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result Dialog */}
      {mp.status === "finished" && (
        <MultiplayerResultDialog
          open={showResultDialog}
          onOpenChange={setShowResultDialog}
          targetPokemon={targetPokemon}
          isShiny={mp.isShiny}
          players={mp.players}
          winnerUserId={mp.winnerUserId}
          currentUserId={user.id}
          targetColors={targetColors}
          roomCode={mp.roomCode}
          onPlayAgain={resetForNewGame}
          onLeave={resetForNewGame}
        />
      )}

      {/* Main layout: Search + Guesses on left, Players panel on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Search and guesses */}
        <div className="lg:col-span-2 space-y-4">
          <div className="space-y-3">
            {gameActive ? (
              <>
                <div className="hidden lg:block">
                  <PokemonSearch
                    pokemonList={allPokemonList}
                    selectedPokemon={null}
                    onPokemonSelect={handleGuess}
                    isShiny={mp.isShiny}
                    guessedPokemonIds={guesses.map((g) => g.pokemonId)}
                    placeholder="Enter Pokémon name or number…"
                  />
                </div>
                <div className="lg:hidden">
                  <Button
                    onClick={() => setShowSearchDialog(true)}
                    className="w-full cursor-pointer"
                    variant="outline"
                  >
                    <Search className="w-4 h-4 mr-2" aria-hidden="true" />
                    Search Pokémon
                  </Button>
                  <Dialog
                    open={showSearchDialog}
                    onOpenChange={setShowSearchDialog}
                  >
                    <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Search Pokémon</DialogTitle>
                      </DialogHeader>
                      <div className="mt-4">
                        <PokemonSearch
                          pokemonList={allPokemonList}
                          selectedPokemon={null}
                          onPokemonSelect={handleGuessWithDialog}
                          isShiny={mp.isShiny}
                          guessedPokemonIds={guesses.map((g) => g.pokemonId)}
                          placeholder="Enter Pokémon name or number…"
                        />
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                {loadingGuess && (
                  <p className="text-sm text-muted-foreground" aria-live="polite">
                    Analyzing guess{"…"}
                  </p>
                )}
              </>
            ) : (
              !mp.targetPokemonId && (
                <p className="text-sm text-muted-foreground text-center">
                  Waiting for game to finish{"…"}
                </p>
              )
            )}
          </div>

          {/* Guesses */}
          <div className="space-y-3">
            <div className="flex flex-col gap-3">
              {Array.from({ length: MAX_ATTEMPTS }).map((_, index) => {
                const guess = guesses[index];
                const isCorrect =
                  guess && targetPokemon
                    ? guess.pokemonId === targetPokemon.id
                    : false;
                return guess ? (
                  <GuessCard
                    key={index}
                    guess={guess}
                    index={index}
                    isCorrect={isCorrect}
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
                    className="flex items-stretch rounded-lg border bg-card/50 opacity-50 flex-shrink-0 overflow-hidden"
                  >
                    <div className="flex-1 min-w-0 flex items-center gap-4 p-3">
                      <div className="relative flex-shrink-0 w-16 h-16 bg-muted rounded" />
                      <div className="flex-1 min-w-0">
                        <div className="h-4 bg-muted rounded mb-2 w-24" />
                        <div className="h-3 bg-muted rounded w-16" />
                      </div>
                    </div>
                    <div className="flex-shrink-0 w-10 self-stretch bg-muted" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Players panel */}
        <div className="lg:col-span-1 space-y-4">
          <OpponentStatus
            currentPlayer={currentPlayer}
            opponent={opponent}
            maxAttempts={MAX_ATTEMPTS}
            primaryColor={
              targetColors.length > 0 ? targetColors[0].hex : undefined
            }
            isWaitingForOpponent={mp.status === "waiting"}
          />

          {gameActive && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="w-3 h-3" aria-hidden="true" />
                  How It Works
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>Both players see the same color palette</li>
                  <li>You each get {MAX_ATTEMPTS} guesses</li>
                  <li>First to guess correctly wins</li>
                  <li>If neither guesses right, highest similarity wins</li>
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
