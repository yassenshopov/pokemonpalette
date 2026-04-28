"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { track } from "@/lib/analytics";
import { GameLeaderboard } from "@/components/game-leaderboard";

// Single row in the daily leaderboard — same shape on the public board
// and inside the per-user `neighbors` payload. `won=false` represents a
// loss / give-up; UI renders that as "X" rather than "n/4".
export interface DailyEntry {
  rank: number;
  userId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  attempts: number;
  hintsUsed: number;
  won: boolean;
}

interface PublicResponse {
  date: string;
  totalPlayers: number;
  entries: DailyEntry[];
}

interface MeResponse {
  date: string;
  totalPlayers: number;
  rank: number | null;
  played: boolean;
  currentStreak: number;
  neighbors: DailyEntry[];
}

const TOP_LIMIT = 10;
const NEIGHBOR_WINDOW = 2;

// Fetches today's leaderboard slices in parallel. The two endpoints are
// separated on purpose — the public list is edge-cacheable, the /me row
// is per-user. Combining them at the client keeps both characteristics.
export function GameLeaderboardSection() {
  const { user, isLoaded: userLoaded } = useUser();
  const [publicData, setPublicData] = useState<PublicResponse | null>(null);
  const [meData, setMeData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/daily-game-attempts/leaderboard?limit=${TOP_LIMIT}`)
      .then((res) => (res.ok ? (res.json() as Promise<PublicResponse>) : null))
      .then((data) => {
        if (cancelled) return;
        setPublicData(data);
      })
      .catch(() => {
        if (!cancelled) setPublicData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-key on user.id so signing in/out flips the row cleanly. Gated on
  // userLoaded to avoid a flash of "Unauthorized" while Clerk hydrates.
  useEffect(() => {
    if (!userLoaded || !user?.id) {
      setMeData(null);
      return;
    }
    let cancelled = false;
    fetch(
      `/api/daily-game-attempts/leaderboard/me?neighbors=${NEIGHBOR_WINDOW}`
    )
      .then((res) => (res.ok ? (res.json() as Promise<MeResponse>) : null))
      .then((data) => {
        if (cancelled) return;
        setMeData(data);
      })
      .catch(() => {
        if (!cancelled) setMeData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, userLoaded]);

  useEffect(() => {
    track("leaderboard_viewed", { variant: "daily_simple" });
  }, []);

  return (
    <GameLeaderboard
      loading={loading}
      entries={publicData?.entries ?? []}
      totalPlayers={publicData?.totalPlayers ?? 0}
      currentUserId={user?.id}
      isSignedIn={!!user?.id && userLoaded}
      me={meData}
    />
  );
}
