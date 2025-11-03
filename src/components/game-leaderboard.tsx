"use client";

import { Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface LeaderboardEntry {
  userId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  currentStreak: number;
  winRate: number;
  totalWins: number;
}

interface GameLeaderboardProps {
  leaderboard: LeaderboardEntry[];
  loading: boolean;
  currentUserId?: string;
  currentUserPosition: number | null;
}

export function GameLeaderboard({
  leaderboard,
  loading,
  currentUserId,
  currentUserPosition,
}: GameLeaderboardProps) {
  return (
    <div className="w-full mt-6">
      <div className="p-4 rounded-lg border bg-card">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h2 className="text-lg font-semibold">Leaderboard</h2>
        </div>

        {loading ? (
          <div className="text-center py-4 text-muted-foreground">
            Loading leaderboard...
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            No leaderboard data yet. Be the first to play!
          </div>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((entry, index) => {
              const isCurrentUser = currentUserId && entry.userId === currentUserId;
              const displayName =
                entry.username ||
                `${entry.firstName || ""} ${entry.lastName || ""}`.trim() ||
                "Anonymous";

              return (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-3 p-3 rounded-md border transition-colors ${
                    isCurrentUser
                      ? "bg-primary/10 border-primary/30"
                      : "bg-background"
                  }`}
                >
                  <div className="flex-shrink-0 w-8 text-center">
                    <span
                      className={`text-sm font-bold ${
                        index === 0
                          ? "text-yellow-500"
                          : index === 1
                          ? "text-gray-400"
                          : index === 2
                          ? "text-orange-600"
                          : "text-muted-foreground"
                      }`}
                    >
                      #{index + 1}
                    </span>
                  </div>
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={entry.imageUrl || undefined}
                      alt={displayName}
                    />
                    <AvatarFallback>
                      {displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        isCurrentUser ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {displayName}
                      {isCurrentUser && " (You)"}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="text-center">
                      <div className="font-semibold text-foreground">
                        {entry.currentStreak}
                      </div>
                      <div>Streak</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-foreground">
                        {entry.winRate}%
                      </div>
                      <div>Win</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-foreground">
                        {entry.totalWins}
                      </div>
                      <div>Wins</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {currentUserPosition !== null && currentUserPosition > 10 && (
          <div className="mt-4 pt-4 border-t text-center text-sm text-muted-foreground">
            Your position: #{currentUserPosition}
          </div>
        )}
      </div>
    </div>
  );
}

