"use client";

import Image from "next/image";
import { User, Trophy, Target, Clock, Loader2, Swords } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { MultiplayerPlayer } from "@/hooks/use-multiplayer";

interface PlayerCardProps {
  player: MultiplayerPlayer | null;
  maxAttempts: number;
  primaryColor?: string;
  label: string;
  isYou?: boolean;
  isWaiting?: boolean;
}

function PlayerCard({
  player,
  maxAttempts,
  primaryColor,
  label,
  isYou,
  isWaiting,
}: PlayerCardProps) {
  if (isWaiting || !player) {
    return (
      <div className="flex-1 rounded-lg border border-dashed bg-card/50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Waiting{"\u2026"}
            </p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </div>
    );
  }

  const progressPercent = (player.attempts / maxAttempts) * 100;
  const displayName = player.username || (isYou ? "You" : "Opponent");

  return (
    <div
      className="flex-1 rounded-lg border bg-card p-4 space-y-3"
      style={
        isYou && primaryColor
          ? { borderColor: `${primaryColor}40` }
          : undefined
      }
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden"
            style={{
              backgroundColor: primaryColor
                ? `${primaryColor}20`
                : "hsl(var(--muted))",
              color: primaryColor || "hsl(var(--muted-foreground))",
            }}
          >
            {player.imageUrl ? (
              <Image
                src={player.imageUrl}
                alt={displayName}
                width={32}
                height={32}
                className="w-8 h-8 rounded-full object-cover"
                unoptimized
              />
            ) : (
              <User className="w-4 h-4" aria-hidden="true" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium">
              {displayName}
              {isYou && (
                <span className="text-xs text-muted-foreground ml-1">
                  (you)
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>

        {player.finished ? (
          <Badge
            variant={player.won ? "default" : "secondary"}
            className="text-xs"
            style={
              player.won && primaryColor
                ? { backgroundColor: primaryColor, color: "white" }
                : undefined
            }
          >
            {player.won ? (
              <>
                <Trophy className="w-3 h-3 mr-1" aria-hidden="true" />
                Got it!
              </>
            ) : (
              "Finished"
            )}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs">
            <Clock className="w-3 h-3 mr-1" aria-hidden="true" />
            Playing{"\u2026"}
          </Badge>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Target className="w-3 h-3" aria-hidden="true" />
            Guesses: {player.attempts}/{maxAttempts}
          </span>
          {player.attempts > 0 && (
            <span>Best: {Math.round(player.bestSimilarity * 100)}%</span>
          )}
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>
    </div>
  );
}

interface OpponentStatusProps {
  currentPlayer: MultiplayerPlayer | null;
  opponent: MultiplayerPlayer | null;
  maxAttempts: number;
  primaryColor?: string;
  isWaitingForOpponent?: boolean;
}

export function OpponentStatus({
  currentPlayer,
  opponent,
  maxAttempts,
  primaryColor,
  isWaitingForOpponent,
}: OpponentStatusProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
        <Swords className="w-4 h-4" aria-hidden="true" />
        Players
      </h3>
      <div className="flex flex-col gap-3">
        <PlayerCard
          player={currentPlayer}
          maxAttempts={maxAttempts}
          primaryColor={primaryColor}
          label="Player 1"
          isYou
        />
        <div className="flex items-center justify-center">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            vs
          </span>
        </div>
        <PlayerCard
          player={opponent}
          maxAttempts={maxAttempts}
          primaryColor={primaryColor}
          label="Player 2"
          isWaiting={isWaitingForOpponent}
        />
      </div>
    </div>
  );
}
