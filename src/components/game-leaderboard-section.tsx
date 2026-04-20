"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { track } from "@vercel/analytics";
import { GameLeaderboard } from "@/components/game-leaderboard";

interface LeaderboardEntry {
  userId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  totalGames: number;
  totalWins: number;
  winRate: number;
  currentStreak: number;
  longestStreak: number;
  averageAttempts: number;
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
}

type SortBy = "currentStreak" | "winRate" | "totalWins" | "averageAttempts";

const LIMIT = 25;

// Small presentational wrapper around GameLeaderboard that fetches from the
// (edge-cached) /api/daily-game-attempts/leaderboard endpoint and computes
// the signed-in user's position client-side. Keeping per-user data out of
// the API response is what lets that endpoint be shared-cacheable at all -
// see the IMPORTANT note in src/app/api/daily-game-attempts/leaderboard/route.ts.
export function GameLeaderboardSection() {
  const { user } = useUser();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>("currentStreak");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/daily-game-attempts/leaderboard?sortBy=${sortBy}&limit=${LIMIT}`)
      .then((res) => (res.ok ? (res.json() as Promise<LeaderboardResponse>) : null))
      .then((data) => {
        if (cancelled) return;
        setEntries(data?.leaderboard ?? []);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sortBy]);

  useEffect(() => {
    track("leaderboard_viewed", { sort_by: sortBy });
  }, [sortBy]);

  const currentUserPosition = user?.id
    ? entries.findIndex((e) => e.userId === user.id) + 1 || null
    : null;

  const tabs: { id: SortBy; label: string }[] = [
    { id: "currentStreak", label: "Streak" },
    { id: "winRate", label: "Win rate" },
    { id: "totalWins", label: "Wins" },
    { id: "averageAttempts", label: "Avg attempts" },
  ];

  return (
    <div className="w-full max-w-6xl">
      <div className="mb-3 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSortBy(tab.id)}
            className={`px-3 py-1.5 text-sm rounded-md border transition-colors cursor-pointer ${
              sortBy === tab.id
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <GameLeaderboard
        leaderboard={entries.map((e) => ({
          userId: e.userId,
          username: e.username ?? undefined,
          firstName: e.firstName ?? undefined,
          lastName: e.lastName ?? undefined,
          imageUrl: e.imageUrl ?? undefined,
          currentStreak: e.currentStreak,
          winRate: e.winRate,
          totalWins: e.totalWins,
        }))}
        loading={loading}
        currentUserId={user?.id}
        currentUserPosition={currentUserPosition}
      />
    </div>
  );
}
