"use client";

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
import { LogIn } from "lucide-react";
import { Pokemon } from "@/types/pokemon";
import { type ColorWithFrequency } from "@/lib/color-extractor";
import { UnlimitedModeSettingsDialog } from "@/components/unlimited-mode-settings";
import Image from "next/image";

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

  if (generation <= 5) {
    // Use animated BW2 sprite for Gen V and earlier
    const shinyPath = isShiny ? "shiny/" : "";
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${shinyPath}${pokemonId}.gif`;
  } else {
    // Use regular sprite for Gen VI and later
    const shinyPath = isShiny ? "shiny/" : "";
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${shinyPath}${pokemonId}.png`;
  }
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
}: GameResultDialogProps) {
  const isWon = status === "won";
  const title = isWon ? "🎉 You Won!" : "Game Over";
  const titleClassName = isWon
    ? "text-2xl font-bold"
    : "text-2xl font-bold text-red-600 dark:text-red-400";

  const spriteUrl = targetPokemon && isShiny !== null 
    ? getSpriteUrl(targetPokemon, isShiny === true)
    : null;

  // Get primary color for text contrast
  const primaryColor = targetColors.length > 0 ? targetColors[0].hex : undefined;
  const getTextColor = (hex: string | undefined): "#ffffff" | "#000000" => {
    if (!hex) return "#000000";
    const hexClean = hex.replace("#", "");
    const r = parseInt(hexClean.substring(0, 2), 16);
    const g = parseInt(hexClean.substring(2, 4), 16);
    const b = parseInt(hexClean.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#000000" : "#ffffff";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden relative">
        {/* Color Bar Background - full dialog */}
        {targetColors.length > 0 && (
          <div className="absolute inset-0 flex opacity-90">
            {(() => {
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

              return normalizedColors.map((color, index) => (
                <div
                  key={index}
                  className="h-full"
                  style={{
                    backgroundColor: color.hex,
                    width: `${color.normalizedPercentage}%`,
                  }}
                />
              ));
            })()}
          </div>
        )}

        {/* Content on top */}
        <div className="relative z-10 p-6">
          <DialogHeader>
            <DialogTitle
              className={titleClassName}
              style={{
                color: primaryColor
                  ? getTextColor(primaryColor)
                  : undefined,
              }}
            >
              {title}
            </DialogTitle>
            {targetPokemon && (
              <DialogDescription
                className="text-base mt-2"
                style={{
                  color: primaryColor
                    ? getTextColor(primaryColor)
                    : undefined,
                  opacity: 0.9,
                }}
              >
                The Pokemon was <strong>{targetPokemon.name}</strong>
                {isShiny === true ? " (Shiny)" : ""}!
              </DialogDescription>
            )}
          </DialogHeader>

          {/* Pokemon Sprite */}
          {spriteUrl && targetPokemon && (
            <div className="flex justify-center items-center py-4">
              <div className="relative">
                <Image
                  src={spriteUrl}
                  alt={targetPokemon.name}
                  width={192}
                  height={192}
                  className="w-48 h-48 object-contain"
                  style={{ imageRendering: "pixelated" }}
                  unoptimized
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
            {mode === "daily" && !user && (
              <SignInButton mode="modal">
                <Button className="w-full cursor-pointer">
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In to Save Progress
                </Button>
              </SignInButton>
            )}
            {mode === "unlimited" && (
              <>
                {unlimitedSettings && onUnlimitedSettingsChange && (
                  <UnlimitedModeSettingsDialog
                    settings={unlimitedSettings}
                    onSettingsChange={onUnlimitedSettingsChange}
                    primaryColor={
                      targetColors.length > 0 && targetColors[0]?.hex
                        ? targetColors[0].hex
                        : undefined
                    }
                    availableGenerations={availableGenerations}
                  />
                )}
                <Button
                  onClick={onResetGame}
                  className="w-full cursor-pointer"
                  style={{
                    backgroundColor: primaryColor
                      ? getTextColor(primaryColor) === "#ffffff"
                        ? "rgba(255, 255, 255, 0.2)"
                        : "rgba(0, 0, 0, 0.2)"
                      : undefined,
                    color: primaryColor ? getTextColor(primaryColor) : undefined,
                    borderColor: primaryColor
                      ? getTextColor(primaryColor) === "#ffffff"
                        ? "rgba(255, 255, 255, 0.3)"
                        : "rgba(0, 0, 0, 0.3)"
                      : undefined,
                  }}
                >
                  {isWon ? "Play Again" : "Try Again"}
                </Button>
              </>
            )}
            {mode === "daily" && user && (
              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                className="w-full cursor-pointer"
                style={{
                  backgroundColor: primaryColor
                    ? getTextColor(primaryColor) === "#ffffff"
                      ? "rgba(255, 255, 255, 0.1)"
                      : "rgba(0, 0, 0, 0.1)"
                    : undefined,
                  color: primaryColor ? getTextColor(primaryColor) : undefined,
                  borderColor: primaryColor
                    ? getTextColor(primaryColor) === "#ffffff"
                      ? "rgba(255, 255, 255, 0.3)"
                      : "rgba(0, 0, 0, 0.3)"
                    : undefined,
                }}
              >
                Close
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

