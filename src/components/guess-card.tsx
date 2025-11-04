"use client";

import Image from "next/image";
import { CheckCircle2 } from "lucide-react";

interface Guess {
  pokemonId: number;
  pokemonName: string;
  colors: string[];
  similarity: number;
  spriteUrl: string | null;
}

interface GuessCardProps {
  guess: Guess;
  index: number;
  isCorrect?: boolean;
  onRef?: (el: HTMLDivElement | null) => void;
}

export function GuessCard({ guess, index, isCorrect = false, onRef }: GuessCardProps) {
  return (
    <div
      ref={onRef}
      className="flex items-center gap-4 p-3 rounded-lg border bg-card flex-shrink-0"
    >
      {/* Image - Leftmost */}
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

      {/* Name and Match % - Center */}
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
      </div>

      {/* Colors - Rightmost */}
      <div className="flex gap-1.5 items-center flex-shrink-0">
        {guess.colors.map((color, colorIndex) => (
          <div
            key={colorIndex}
            className="h-10 w-10 rounded-md border-2"
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
    </div>
  );
}

