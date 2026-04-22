"use client";

import Image from "next/image";
import { CheckCircle2, Dna, Tags } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { GuessRelatedness } from "@/lib/game/relatedness";

interface Guess {
  pokemonId: number;
  pokemonName: string;
  colors: string[];
  similarity: number;
  spriteUrl: string | null;
  relatedness?: GuessRelatedness | null;
}

interface GuessCardProps {
  guess: Guess;
  index: number;
  isCorrect?: boolean;
  onRef?: (el: HTMLDivElement | null) => void;
}

export function GuessCard({ guess, index, isCorrect = false, onRef }: GuessCardProps) {
  const relatedness = guess.relatedness;
  // Only surface relatedness hints for wrong guesses. A correct guess already
  // says "Correct!" and piling "Same type" on top is redundant noise.
  const showRelatedness =
    !isCorrect &&
    !!relatedness &&
    (relatedness.sharedTypes.length > 0 || relatedness.sameEvolutionFamily);

  return (
    <div
      ref={onRef}
      // `overflow-hidden` lets the flush-right swatch get clipped by the
      // card's rounded corners instead of poking through them. `items-stretch`
      // is what allows the swatch column to fill the full card height.
      className="flex items-stretch rounded-lg border bg-card flex-shrink-0 overflow-hidden"
    >
      {/* Left + middle: image and text share a padded region. Keeping the
          padding here (instead of on the parent) is what lets the swatch on
          the right flush to the top/bottom/right edges of the card. */}
      <div className="flex-1 min-w-0 flex items-center gap-4 p-3">
        {guess.spriteUrl && (
          <div className="relative flex-shrink-0">
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
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm truncate">{guess.pokemonName}</h3>
            {isCorrect && (
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {isCorrect ? "Correct!" : `${Math.round(guess.similarity * 100)}% match`}
          </span>

          {showRelatedness && relatedness && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {relatedness.sameEvolutionFamily && (
                <Badge
                  variant="outline"
                  className="h-5 px-1.5 text-[10px] font-medium gap-1 border-emerald-400/60 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
                >
                  <Dna className="w-3 h-3" />
                  Same evolution family
                </Badge>
              )}
              {relatedness.sharedTypes.length > 0 && (
                <Badge
                  variant="outline"
                  className="h-5 px-1.5 text-[10px] font-medium gap-1 border-amber-400/60 text-amber-700 dark:text-amber-300 bg-amber-500/10"
                >
                  <Tags className="w-3 h-3" />
                  {relatedness.sharedTypes.length === 1
                    ? `Same type: ${relatedness.sharedTypes[0]}`
                    : `Shared types: ${relatedness.sharedTypes.join(" / ")}`}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Swatch column — flush to the card's top, bottom, and right edges so
          it reads as one continuous stripe (mirrors the big target palette
          bar at the top of the page). */}
      <div className="flex-shrink-0 flex flex-col w-10 self-stretch">
        {guess.colors.map((color, colorIndex) => (
          <div
            key={colorIndex}
            className="flex-1"
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
    </div>
  );
}
