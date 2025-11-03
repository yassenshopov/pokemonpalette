"use client";

import Image from "next/image";

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
  onRef?: (el: HTMLDivElement | null) => void;
}

export function GuessCard({ guess, index, onRef }: GuessCardProps) {
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
        <h3 className="font-semibold text-sm truncate">{guess.pokemonName}</h3>
        <span className="text-xs text-muted-foreground">
          {Math.round(guess.similarity * 100)}% match
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

