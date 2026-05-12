"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SignInButton } from "@clerk/nextjs";
import {
  LogIn,
  RefreshCw,
  Flame,
  Calendar,
  Clock,
  Sparkles,
  Share2,
  Coffee,
  BookMarked,
} from "lucide-react";
import { Pokemon } from "@/types/pokemon";
import { type ColorWithFrequency } from "@/lib/color-extractor";
import { UnlimitedModeSettingsDialog } from "@/components/unlimited-mode-settings";
import Link from "next/link";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import {
  buildShareText,
  getDailyGameNumber,
  shareOrCopy,
  type ShareGridGuess,
} from "@/lib/game/share";
import { getContrastHex } from "@/lib/game/colors";

// Get generation from Pokemon ID
function getGenerationFromId(id: number): number {
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
}

// Get sprite URL - animated BW2 for Gen V and earlier, regular sprite for later gens
function getSpriteUrl(pokemon: Pokemon, isShiny: boolean): string {
  const generation = getGenerationFromId(pokemon.id);
  const pokemonId = pokemon.id;

  // For Gen VI+, try local first, then fallback to URL
  if (generation > 5) {
    return `/pokemon/sprites/${isShiny ? "shiny/" : ""}${pokemonId}.png`;
  }
  
  // For Gen V and earlier, use animated sprites (no local version available)
  const shinyPath = isShiny ? "shiny/" : "";
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${shinyPath}${pokemonId}.gif`;
}

interface UserStats {
  currentStreak: number;
  longestStreak: number;
  totalGames: number;
  totalWins: number;
  winRate: number;
}

interface GameResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: "won" | "lost";
  targetPokemon: Pokemon | null;
  isShiny: boolean | null;
  mode: "daily" | "unlimited";
  user: any;
  onResetGame: () => void;
  targetColors?: ColorWithFrequency[];
  unlimitedSettings?: {
    shinyPreference: "both" | "shiny" | "normal";
    selectedGenerations: number[];
  };
  onUnlimitedSettingsChange?: (settings: {
    shinyPreference: "both" | "shiny" | "normal";
    selectedGenerations: number[];
  }) => void;
  availableGenerations?: number[];
  userStats?: UserStats | null;
  // Used by the daily-mode Wordle-style share grid.
  guesses?: ShareGridGuess[];
  attempts?: number;
  hintsUsed?: number;
  // Result of the Pokedex catch recorded for this win, if any. Resolved
  // asynchronously after the dialog opens — the parent updates this when
  // the /api/pokedex response arrives. `isNew` distinguishes a first
  // catch from a re-catch so we only celebrate genuinely new entries.
  pokedexCatch?: {
    isNew: boolean;
    isShiny: boolean;
    pokemonName: string;
  } | null;
}

export function GameResultDialog({
  open,
  onOpenChange,
  status,
  targetPokemon,
  isShiny,
  mode,
  user,
  onResetGame,
  targetColors = [],
  unlimitedSettings,
  onUnlimitedSettingsChange,
  availableGenerations = [],
  userStats,
  guesses = [],
  attempts = 0,
  hintsUsed = 0,
  pokedexCatch = null,
}: GameResultDialogProps) {
  const isWon = status === "won";
  const title = isWon ? "🎉 You Won!" : "Game Over";
  const titleClassName = "text-4xl font-bold";

  const spriteUrl =
    targetPokemon && isShiny !== null
      ? getSpriteUrl(targetPokemon, isShiny === true)
      : null;
  
  // Get fallback URL for Gen VI+ sprites
  const fallbackSpriteUrl = targetPokemon && isShiny !== null && getGenerationFromId(targetPokemon.id) > 5
    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${
        isShiny === true ? "shiny/" : ""
      }${targetPokemon.id}.png`
    : spriteUrl;

  // Determine if this is an animated BW2 sprite (Gen V and earlier)
  const isAnimatedBW2Sprite =
    targetPokemon && getGenerationFromId(targetPokemon.id) <= 5;

  // Get primary color and calculate contrast text color
  const primaryColor = targetColors[0]?.hex;
  const getTextColor = (hex: string | undefined): "#ffffff" | "#000000" =>
    hex ? getContrastHex(hex) : "#000000";

  const handleShare = async () => {
    if (mode !== "daily" || !targetPokemon) return;
    const shareText = buildShareText({
      gameNumber: getDailyGameNumber(),
      attempts,
      won: isWon,
      hintsUsed,
      targetColors: targetColors.map((c) => c.hex),
      guesses,
      url: "https://pokemonpalette.com/game",
    });
    const result = await shareOrCopy(shareText);
    if (result === "copied") {
      toast.success("Result copied to clipboard!", {
        description: "Paste it anywhere to share.",
      });
    } else if (result === "failed") {
      toast.error("Couldn't share. Try selecting and copying manually.");
    }
    track("share_grid_clicked", {
      won: isWon,
      attempts,
      hints_used: hintsUsed,
      outcome: result,
    });
  };

  // Calculate time until next puzzle (midnight UTC)
  const [timeUntilNext, setTimeUntilNext] = useState<string>("");

  useEffect(() => {
    if (mode !== "daily") {
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      // Get UTC date components
      const utcYear = now.getUTCFullYear();
      const utcMonth = now.getUTCMonth();
      const utcDate = now.getUTCDate();

      // Create tomorrow at midnight UTC
      const tomorrowUTC = new Date(
        Date.UTC(utcYear, utcMonth, utcDate + 1, 0, 0, 0)
      );

      const diff = tomorrowUTC.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeUntilNext(
        `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [mode, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col"
        showCloseButton={false}
      >
        {/* Color Bar Background - full dialog with angled gradient */}
        {targetColors.length > 0 && (
          <div
            className="absolute inset-0 opacity-15"
            style={{
              background: (() => {
                // Normalize percentages to sum to 100%
                const totalPercentage = targetColors.reduce(
                  (sum, color) => sum + color.percentage,
                  0
                );
                const normalizedColors = targetColors.map((color) => ({
                  ...color,
                  normalizedPercentage:
                    totalPercentage > 0
                      ? (color.percentage / totalPercentage) * 100
                      : 100 / targetColors.length,
                }));

                // Calculate cumulative percentages for gradient stops with hard edges
                let cumulative = 0;
                const stops: string[] = [];
                normalizedColors.forEach((color) => {
                  const start = `${cumulative}%`;
                  cumulative += color.normalizedPercentage;
                  const end = `${cumulative}%`;
                  // Create hard stops by using the same color at start and end positions
                  stops.push(`${color.hex} ${start}, ${color.hex} ${end}`);
                });

                return `linear-gradient(135deg, ${stops.join(", ")})`;
              })(),
            }}
          />
        )}

        {/* Content on top - scrollable if it exceeds viewport */}
        <div className="relative z-10 p-6 flex flex-col flex-1 min-h-0 overflow-y-auto">
          <DialogHeader>
            <DialogTitle className={`${titleClassName} font-heading`}>
              {title}
            </DialogTitle>
            {targetPokemon && (
              <DialogDescription className="text-lg mt-2">
                The Pokemon was <strong>{targetPokemon.name}</strong>
                {isShiny === true ? " (Shiny)" : ""}!
              </DialogDescription>
            )}
          </DialogHeader>

          {/* Pokemon Sprite */}
          {spriteUrl && targetPokemon && (
            <div className="flex justify-center items-center py-4 flex-1">
              <div className="relative">
                <GameSprite
                  src={spriteUrl}
                  fallbackUrl={fallbackSpriteUrl || null}
                  alt={targetPokemon.name}
                  width={isAnimatedBW2Sprite ? 144 : 192}
                  height={isAnimatedBW2Sprite ? 144 : 192}
                  className={
                    isAnimatedBW2Sprite
                      ? "w-36 h-36 object-contain"
                      : "w-48 h-48 object-contain"
                  }
                />
              </div>
            </div>
          )}

          {/* Stats and Timer for Daily Mode */}
          {mode === "daily" && userStats && (
            <div className="py-4 border-t border-b">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Games Played
                    </p>
                    <p className="text-lg font-bold">{userStats.totalGames}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Current Streak
                    </p>
                    <p className="text-lg font-bold">
                      {userStats.currentStreak} days
                    </p>
                  </div>
                </div>
                {timeUntilNext && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Next puzzle in
                      </p>
                      <p className="text-lg font-bold font-mono">
                        {timeUntilNext}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pokedex catch banner — only shown for genuinely new entries
              (re-catches are silent so we don't fire celebratory copy on
              every repeat win). Lands at the emotional peak right under
              the sprite, before the coffee ask. */}
          {isWon && pokedexCatch?.isNew && (
            <PokedexCatchBanner
              primaryColor={primaryColor}
              pokemonName={pokedexCatch.pokemonName}
              isShiny={pokedexCatch.isShiny}
            />
          )}

          {/* Contextual "tip the dev" ask. Only rendered on wins because asking
              a frustrated losing player for money is a bad look. Copy adapts
              to how impressive the win was — one-shots and long streaks get a
              more earned-sounding ask. */}
          {isWon && (
            <CoffeeAsk
              primaryColor={primaryColor}
              attempts={attempts}
              currentStreak={userStats?.currentStreak ?? 0}
              mode={mode}
            />
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4 mt-auto justify-start">
            {/* Group buttons for unlimited mode */}
            {mode === "unlimited" && (
              <div className="flex items-center gap-2 flex-wrap">
                {targetPokemon && (
                  <Link
                    href={`/${targetPokemon.name.toLowerCase()}`}
                    className="w-full sm:w-auto"
                    onClick={() =>
                      track("explore_palette_clicked", {
                        placement: "result_dialog",
                        pokemon_id: targetPokemon.id,
                        mode,
                        won: isWon,
                      })
                    }
                  >
                    <Button
                      variant="outline"
                      className="w-full cursor-pointer"
                      style={{
                        backgroundColor: primaryColor || undefined,
                        color: primaryColor
                          ? getTextColor(primaryColor)
                          : undefined,
                        borderColor: primaryColor || undefined,
                      }}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Explore {targetPokemon.name}&apos;s palette
                    </Button>
                  </Link>
                )}
                {unlimitedSettings && onUnlimitedSettingsChange && (
                  <UnlimitedModeSettingsDialog
                    settings={unlimitedSettings}
                    onSettingsChange={(newSettings) => {
                      onUnlimitedSettingsChange(newSettings);
                      onOpenChange(false);
                      onResetGame();
                    }}
                    availableGenerations={availableGenerations}
                  />
                )}
                <Button
                  onClick={onResetGame}
                  variant="default"
                  className="cursor-pointer"
                  style={{
                    backgroundColor: primaryColor || undefined,
                    color: primaryColor
                      ? getTextColor(primaryColor)
                      : undefined,
                  }}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {isWon ? "Play Again" : "Try Again"}
                </Button>
              </div>
            )}
            {/* Daily mode buttons */}
            {mode === "daily" && (
              <>
                {guesses.length > 0 && (
                  <Button
                    onClick={handleShare}
                    className="w-full sm:w-auto cursor-pointer"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share result
                  </Button>
                )}
                {targetPokemon && (
                  <Link
                    href={`/${targetPokemon.name.toLowerCase()}`}
                    className="w-full sm:w-auto"
                    onClick={() =>
                      track("explore_palette_clicked", {
                        placement: "result_dialog",
                        pokemon_id: targetPokemon.id,
                        mode,
                        won: isWon,
                      })
                    }
                  >
                    <Button
                      variant="outline"
                      className="w-full cursor-pointer"
                      style={{
                        backgroundColor: primaryColor || undefined,
                        color: primaryColor
                          ? getTextColor(primaryColor)
                          : undefined,
                        borderColor: primaryColor || undefined,
                      }}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Explore {targetPokemon.name}&apos;s palette
                    </Button>
                  </Link>
                )}
                {!user && (
                  <SignInButton mode="modal">
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto cursor-pointer"
                      onClick={() =>
                        track("sign_in_from_game_clicked", {
                          won: isWon,
                          attempts,
                          mode,
                        })
                      }
                    >
                      <LogIn className="w-4 h-4 mr-2" />
                      Sign In to Save Progress
                    </Button>
                  </SignInButton>
                )}
                {user && (
                  <Button
                    onClick={() => onOpenChange(false)}
                    variant="outline"
                    className="cursor-pointer"
                  >
                    Close
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Contextual tip-the-dev ask shown inside the win dialog. Kept local to this
// file because the copy/framing is tightly coupled to "just finished a game"
// — it's not a reusable primitive.
function CoffeeAsk({
  primaryColor,
  attempts,
  currentStreak,
  mode,
}: {
  primaryColor: string | undefined;
  attempts: number;
  currentStreak: number;
  mode: "daily" | "unlimited";
}) {
  const textColor = primaryColor ? getContrastHex(primaryColor) : "#000000";

  // Pick copy that feels earned based on what the player just did. The goal
  // is for the ask to land at the emotional peak — a generic "buy me a
  // coffee" converts worse than one that references the moment.
  const { headline, subtext } = (() => {
    if (mode === "daily" && currentStreak >= 7) {
      return {
        headline: `${currentStreak}-day streak. You're officially obsessed.`,
        subtext:
          "Pokémon Palette is made by one dev in their spare time. A coffee keeps it going.",
      };
    }
    if (attempts === 1) {
      return {
        headline: "One-shot. Impressive.",
        subtext:
          "If this made your day, a coffee helps me make more little games like this.",
      };
    }
    if (attempts === 2) {
      return {
        headline: "Two guesses — nicely done.",
        subtext:
          "Pokémon Palette is a solo project. A coffee goes a long way toward keeping it ad-free.",
      };
    }
    return {
      headline: "Enjoying Pokémon Palette?",
      subtext:
        "It's made by one person, on nights and weekends. A coffee means a lot.",
    };
  })();

  const utmCampaign =
    mode === "daily" ? "win_dialog_daily" : "win_dialog_unlimited";
  const href = `https://buymeacoffee.com/yassenshopov?utm_source=pokemonpalette&utm_medium=win_dialog&utm_campaign=${utmCampaign}`;

  const handleClick = () => {
    track("coffee_clicked", {
      placement: "game_result_dialog",
      mode,
      attempts,
      current_streak: currentStreak,
    });
  };

  return (
    <div
      className="mt-4 rounded-lg border p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4"
      style={{
        borderColor: primaryColor ? `${primaryColor}55` : undefined,
        backgroundColor: primaryColor ? `${primaryColor}12` : undefined,
      }}
    >
      <div
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: primaryColor || "#f59e0b",
          color: textColor,
        }}
      >
        <Coffee className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold font-heading">{headline}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="w-full sm:w-auto flex-shrink-0"
      >
        <Button
          size="sm"
          className="w-full cursor-pointer font-heading transition-all duration-300 hover:scale-105 active:scale-95"
          style={{
            backgroundColor: primaryColor || "#f59e0b",
            color: textColor,
            borderColor: primaryColor || "#f59e0b",
          }}
        >
          <Coffee className="w-4 h-4 mr-2" />
          Support the project
        </Button>
      </a>
    </div>
  );
}

// Banner shown inside the win dialog when the win produced a fresh Pokedex
// entry. Rendered alongside CoffeeAsk and reuses the same "color-tinted
// rounded card" layout for visual continuity.
function PokedexCatchBanner({
  primaryColor,
  pokemonName,
  isShiny,
}: {
  primaryColor: string | undefined;
  pokemonName: string;
  isShiny: boolean;
}) {
  const textColor = primaryColor ? getContrastHex(primaryColor) : "#000000";
  return (
    <div
      className="mt-4 rounded-lg border p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4"
      style={{
        borderColor: primaryColor ? `${primaryColor}55` : undefined,
        backgroundColor: primaryColor ? `${primaryColor}12` : undefined,
      }}
    >
      <div
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: primaryColor || "#f59e0b",
          color: textColor,
        }}
      >
        <BookMarked className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold font-heading flex items-center gap-1.5 flex-wrap">
          New Pokedex entry — {pokemonName}!
          {isShiny && (
            <span className="inline-flex items-center gap-0.5 text-yellow-500">
              <Sparkles className="w-3.5 h-3.5" />
              Shiny
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Added to your Pokedex. Catch the {isShiny ? "normal" : "shiny"}{" "}
          variant to complete this entry.
        </p>
      </div>
      <Link href="/game/pokedex" className="w-full sm:w-auto flex-shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="w-full cursor-pointer font-heading"
          style={{
            borderColor: primaryColor || undefined,
            color: primaryColor || undefined,
          }}
        >
          View Pokedex
        </Button>
      </Link>
    </div>
  );
}

// Component to handle sprite with fallback
function GameSprite({
  src,
  fallbackUrl,
  alt,
  width,
  height,
  className,
}: {
  src: string;
  fallbackUrl: string | null;
  alt: string;
  width: number;
  height: number;
  className?: string;
}) {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (!hasError && fallbackUrl && imgSrc !== fallbackUrl && imgSrc.startsWith('/pokemon/')) {
      setHasError(true);
      setImgSrc(fallbackUrl);
    }
  };

  return (
    <Image
      src={imgSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={{ imageRendering: "pixelated" }}
      unoptimized
      onError={handleError}
    />
  );
}
