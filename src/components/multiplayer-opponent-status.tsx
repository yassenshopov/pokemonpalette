"use client";

import { User, Trophy, Target, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { MultiplayerPlayer } from "@/hooks/use-multiplayer";

interface OpponentStatusProps {
  opponent: MultiplayerPlayer | null;
  maxAttempts: number;
  primaryColor?: string;
}

export function OpponentStatus({
  opponent,
  maxAttempts,
  primaryColor,
}: OpponentStatusProps) {
  if (!opponent) return null;

  const progressPercent = (opponent.attempts / maxAttempts) * 100;
  const displayName = opponent.username || "Opponent";

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
            style={{
              backgroundColor: primaryColor
                ? `${primaryColor}20`
                : "hsl(var(--muted))",
              color: primaryColor || "hsl(var(--muted-foreground))",
            }}
          >
            {opponent.imageUrl ? (
              <img
                src={opponent.imageUrl}
                alt={displayName}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <User className="w-4 h-4" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium">{displayName}</p>
            <p className="text-xs text-muted-foreground">Opponent</p>
          </div>
        </div>

        {opponent.finished && (
          <Badge
            variant={opponent.won ? "default" : "secondary"}
            className="text-xs"
            style={
              opponent.won && primaryColor
                ? { backgroundColor: primaryColor, color: "white" }
                : undefined
            }
          >
            {opponent.won ? (
              <>
                <Trophy className="w-3 h-3 mr-1" />
                Got it!
              </>
            ) : (
              "Finished"
            )}
          </Badge>
        )}

        {!opponent.finished && (
          <Badge variant="outline" className="text-xs">
            <Clock className="w-3 h-3 mr-1" />
            Playing...
          </Badge>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Target className="w-3 h-3" />
            Guesses: {opponent.attempts}/{maxAttempts}
          </span>
          {opponent.attempts > 0 && (
            <span>
              Best: {Math.round(opponent.bestSimilarity * 100)}%
            </span>
          )}
        </div>
        <Progress
          value={progressPercent}
          className="h-2"
          style={
            primaryColor
              ? ({ "--progress-color": primaryColor } as React.CSSProperties)
              : undefined
          }
        />
      </div>
    </div>
  );
}
