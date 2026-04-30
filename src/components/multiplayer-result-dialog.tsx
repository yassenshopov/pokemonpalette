"use client";

import Image from "next/image";
import {
  Trophy,
  Users,
  Target,
  Medal,
  ArrowRight,
  Copy,
  Check,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Pokemon } from "@/types/pokemon";
import { type ColorWithFrequency } from "@/lib/color-extractor";
import { getContrastHex } from "@/lib/game/colors";
import type { MultiplayerPlayer } from "@/hooks/use-multiplayer";

interface MultiplayerResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPokemon: Pokemon | null;
  isShiny: boolean;
  players: MultiplayerPlayer[];
  winnerUserId: string | null;
  currentUserId: string;
  targetColors: ColorWithFrequency[];
  roomCode: string | null;
  onPlayAgain: () => void;
  onLeave: () => void;
}

export function MultiplayerResultDialog({
  open,
  onOpenChange,
  targetPokemon,
  isShiny,
  players,
  winnerUserId,
  currentUserId,
  targetColors,
  roomCode,
  onPlayAgain,
  onLeave,
}: MultiplayerResultDialogProps) {
  const [copied, setCopied] = useState(false);

  if (!targetPokemon) return null;

  const primaryColor =
    targetColors.length > 0 ? targetColors[0].hex : "#f59e0b";
  const textColor = getContrastHex(primaryColor);
  const isWinner = winnerUserId === currentUserId;
  const isDraw = !winnerUserId;

  const sortedPlayers = [...players].sort((a, b) => {
    if (a.won && !b.won) return -1;
    if (!a.won && b.won) return 1;
    return b.bestSimilarity - a.bestSimilarity;
  });

  const shareResult = async () => {
    const me = players.find((p) => p.userId === currentUserId);
    const resultEmoji = isWinner ? "🏆" : isDraw ? "🤝" : "😔";
    const text = [
      `${resultEmoji} PokémonPalette Multiplayer`,
      `Answer: ${targetPokemon.name}`,
      `My guesses: ${me?.attempts ?? 0}/4`,
      `Best match: ${Math.round((me?.bestSimilarity ?? 0) * 100)}%`,
      `Result: ${isWinner ? "Won!" : isDraw ? "Draw" : "Lost"}`,
      "",
      "https://www.pokemonpalette.com/game",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: do nothing
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-heading flex items-center justify-center gap-2">
            {isWinner ? (
              <>
                <Trophy className="w-6 h-6 text-yellow-500" aria-hidden="true" />
                You Win!
              </>
            ) : isDraw ? (
              <>
                <Users className="w-6 h-6" aria-hidden="true" />
                It\u2019s a Draw!
              </>
            ) : (
              <>
                <Medal className="w-6 h-6 text-gray-400" aria-hidden="true" />
                You Lost
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Pokemon reveal */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
            <Image
              src={
                isShiny
                  ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${targetPokemon.id}.png`
                  : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${targetPokemon.id}.png`
              }
              alt={targetPokemon.name}
              width={100}
              height={100}
              className="w-20 h-20 object-contain"
              unoptimized
            />
            <div>
              <h3 className="font-bold text-lg font-heading">
                {targetPokemon.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                #{targetPokemon.id.toString().padStart(3, "0")}
              </p>
              <div className="flex gap-1 mt-1">
                {targetPokemon.type.map((type) => (
                  <Badge
                    key={type}
                    className="text-xs"
                    style={{
                      backgroundColor: primaryColor,
                      color: textColor,
                    }}
                  >
                    {type}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Player results */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Target className="w-3 h-3" aria-hidden="true" />
              Results
            </h4>
            {sortedPlayers.map((player, index) => {
              const isMe = player.userId === currentUserId;
              const isPlayerWinner = player.userId === winnerUserId;
              return (
                <div
                  key={player.userId}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    isPlayerWinner
                      ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20"
                      : "bg-card"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isPlayerWinner && (
                      <Trophy className="w-4 h-4 text-yellow-500 flex-shrink-0" aria-hidden="true" />
                    )}
                    {!isPlayerWinner && (
                      <span className="w-4 h-4 flex items-center justify-center text-xs text-muted-foreground flex-shrink-0">
                        {index + 1}
                      </span>
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {player.username || (isMe ? "You" : "Opponent")}
                        {isMe && (
                          <span className="text-xs text-muted-foreground ml-1">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {player.won
                          ? `Guessed in ${player.attempts} ${
                              player.attempts === 1 ? "try" : "tries"
                            }`
                          : `${player.attempts}/4 guesses used`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums">
                      {Math.round(player.bestSimilarity * 100)}%
                    </p>
                    <p className="text-xs text-muted-foreground">best match</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <div className="flex gap-2 w-full">
            <Button
              onClick={shareResult}
              variant="outline"
              className="flex-1 cursor-pointer"
            >
              {copied ? (
                <Check className="w-4 h-4 mr-2 text-green-500" aria-hidden="true" />
              ) : (
                <Copy className="w-4 h-4 mr-2" aria-hidden="true" />
              )}
              {copied ? "Copied!" : "Share Result"}
            </Button>
            <Button
              onClick={() => {
                onOpenChange(false);
                onPlayAgain();
              }}
              className="flex-1 cursor-pointer font-heading"
              style={{ backgroundColor: primaryColor, color: textColor }}
            >
              <ArrowRight className="w-4 h-4 mr-2" aria-hidden="true" />
              Play Again
            </Button>
          </div>
          <Button
            onClick={() => {
              onOpenChange(false);
              onLeave();
            }}
            variant="ghost"
            className="w-full cursor-pointer text-muted-foreground"
          >
            Leave Multiplayer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
