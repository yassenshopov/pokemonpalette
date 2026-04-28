"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { track } from "@/lib/analytics";
import { GameLeaderboard } from "@/components/game-leaderboard";

export interface LeaderboardEntry {
  rank: number;
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

export interface MeRow extends Omit<LeaderboardEntry, "rank"> {
  rank: number | null;
  totalRanked: number;
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  meta: {
    sortBy: SortBy;
    window: TimeWindow;
    minGames: number;
    limit: number;
  };
}

interface MeResponse {
  me: MeRow;
}

export type SortBy =
  | "currentStreak"
  | "winRate"
  | "totalWins"
  | "averageAttempts";
export type TimeWindow = "all" | "week" | "today";

const LIMIT = 10;

// Glue layer: owns the sort + time-window state, fetches the public board
// (edge-cached) and the caller's own rank in parallel from the per-user
// /me endpoint. Splitting them keeps the public response shareable across
// users — see the IMPORTANT comment in the leaderboard route.
export function GameLeaderboardSection() {
  const { user, isLoaded: userLoaded } = useUser();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [me, setMe] = useState<MeRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [meLoading, setMeLoading] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("currentStreak");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({
      sortBy,
      window: timeWindow,
      limit: String(LIMIT),
    });
    fetch(`/api/daily-game-attempts/leaderboard?${params}`)
      .then((res) =>
        res.ok ? (res.json() as Promise<LeaderboardResponse>) : null
      )
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
  }, [sortBy, timeWindow]);

  // Fetch the caller's own rank in parallel with the public board. We
  // re-key on user.id so the row clears when they sign out and refetches
  // when they sign in. userLoaded gate avoids a flash of "Unauthorized"
  // while Clerk is hydrating.
  useEffect(() => {
    if (!userLoaded) return;
    if (!user?.id) {
      setMe(null);
      return;
    }
    let cancelled = false;
    setMeLoading(true);
    const params = new URLSearchParams({ sortBy, window: timeWindow });
    fetch(`/api/daily-game-attempts/leaderboard/me?${params}`)
      .then((res) => (res.ok ? (res.json() as Promise<MeResponse>) : null))
      .then((data) => {
        if (cancelled) return;
        setMe(data?.me ?? null);
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      })
      .finally(() => {
        if (!cancelled) setMeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sortBy, timeWindow, user?.id, userLoaded]);

  useEffect(() => {
    track("leaderboard_viewed", {
      sort_by: sortBy,
      time_window: timeWindow,
    });
  }, [sortBy, timeWindow]);

  return (
    <GameLeaderboard
      entries={entries}
      loading={loading}
      me={me}
      meLoading={meLoading}
      currentUserId={user?.id}
      sortBy={sortBy}
      onSortByChange={setSortBy}
      timeWindow={timeWindow}
      onTimeWindowChange={setTimeWindow}
    />
  );
}
