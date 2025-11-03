"use client";

import { Flame, TrendingUp, Trophy } from "lucide-react";

interface UserStats {
  currentStreak: number;
  longestStreak: number;
  totalGames: number;
  totalWins: number;
  winRate: number;
}

interface UserStatsPanelProps {
  userStats: UserStats;
}

export function UserStatsPanel({ userStats }: UserStatsPanelProps) {
  return (
    <div className="mb-4 p-4 rounded-lg border bg-card">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          <div>
            <p className="text-xs text-muted-foreground">Current Streak</p>
            <p className="text-lg font-bold">{userStats.currentStreak} days</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-500" />
          <div>
            <p className="text-xs text-muted-foreground">Best Streak</p>
            <p className="text-lg font-bold">{userStats.longestStreak} days</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <div>
            <p className="text-xs text-muted-foreground">Win Rate</p>
            <p className="text-lg font-bold">
              {userStats.totalGames > 0
                ? Math.round(userStats.winRate)
                : 0}
              %
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

