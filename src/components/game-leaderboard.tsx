"use client";

import { useEffect, useRef } from "react";
import type { gsap as GsapType } from "gsap";
import { Trophy, Medal, Flame, Target, Hash, Zap, Info } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  LeaderboardEntry,
  MeRow,
  SortBy,
  TimeWindow,
} from "@/components/game-leaderboard-section";

interface GameLeaderboardProps {
  entries: LeaderboardEntry[];
  loading: boolean;
  me: MeRow | null;
  meLoading: boolean;
  currentUserId?: string;
  sortBy: SortBy;
  onSortByChange: (s: SortBy) => void;
  timeWindow: TimeWindow;
  onTimeWindowChange: (w: TimeWindow) => void;
}

const SORT_TABS: ReadonlyArray<{ id: SortBy; label: string; short: string }> =
  [
    { id: "currentStreak", label: "Streak", short: "Streak" },
    { id: "winRate", label: "Win rate", short: "Win %" },
    { id: "totalWins", label: "Wins", short: "Wins" },
    { id: "averageAttempts", label: "Avg attempts", short: "Avg" },
  ];

const WINDOW_TABS: ReadonlyArray<{ id: TimeWindow; label: string }> = [
  { id: "all", label: "All time" },
  { id: "week", label: "This week" },
  { id: "today", label: "Today" },
];

// gsap is heavy and used elsewhere in /game already, so we lazy-load it
// the same way game/page.tsx does — no extra cost when this component
// renders if it's already in cache.
type GsapModule = typeof GsapType;
let gsapPromise: Promise<GsapModule> | null = null;
function loadGsap(): Promise<GsapModule> {
  if (!gsapPromise) gsapPromise = import("gsap").then((m) => m.gsap);
  return gsapPromise;
}

function displayName(
  e: Pick<LeaderboardEntry, "username" | "firstName" | "lastName">
): string {
  return (
    e.username ||
    `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim() ||
    "Anonymous"
  );
}

function formatStat(
  sortBy: SortBy,
  e: Pick<
    LeaderboardEntry,
    "currentStreak" | "winRate" | "totalWins" | "averageAttempts"
  >
): { value: string; label: string } {
  switch (sortBy) {
    case "currentStreak":
      return { value: String(e.currentStreak), label: "day streak" };
    case "winRate":
      return { value: `${e.winRate.toFixed(0)}%`, label: "win rate" };
    case "totalWins":
      return { value: String(e.totalWins), label: "wins" };
    case "averageAttempts":
      return { value: e.averageAttempts.toFixed(2), label: "avg attempts" };
  }
}

function StatCell({
  icon: Icon,
  value,
  label,
  emphasize = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string | number;
  label: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon
        className={cn(
          "w-3.5 h-3.5",
          emphasize ? "text-foreground" : "text-muted-foreground"
        )}
      />
      <span
        className={cn(
          "tabular-nums font-semibold",
          emphasize ? "text-foreground" : "text-foreground/80"
        )}
      >
        {value}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<{ id: T; label: string; short?: string }>;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex rounded-lg border bg-muted/40 p-1 gap-1"
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              "px-3 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-all cursor-pointer",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="sm:hidden">{opt.short ?? opt.label}</span>
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Podium card for ranks 1–3. Visually larger than the list rows so the
// top of the board reads as a destination rather than just "the same row,
// smaller numbers".
function PodiumCard({
  entry,
  rank,
  isCurrentUser,
  sortBy,
  registerRef,
}: {
  entry: LeaderboardEntry;
  rank: 1 | 2 | 3;
  isCurrentUser: boolean;
  sortBy: SortBy;
  registerRef: (el: HTMLDivElement | null) => void;
}) {
  const stat = formatStat(sortBy, entry);
  const name = displayName(entry);

  // Podium tints. Yellow/silver/bronze map to the rank's color identity
  // so a glance is enough to read "who's first".
  const tint = {
    1: {
      ring: "ring-yellow-400/60",
      bg: "from-yellow-50 to-yellow-100/40 dark:from-yellow-500/10 dark:to-yellow-500/5",
      icon: "text-yellow-500",
      badge: "bg-yellow-400 text-yellow-950",
    },
    2: {
      ring: "ring-zinc-300/60",
      bg: "from-zinc-50 to-zinc-100/40 dark:from-zinc-500/10 dark:to-zinc-500/5",
      icon: "text-zinc-400",
      badge: "bg-zinc-300 text-zinc-900",
    },
    3: {
      ring: "ring-amber-600/40",
      bg: "from-amber-50 to-amber-100/40 dark:from-amber-700/10 dark:to-amber-700/5",
      icon: "text-amber-600",
      badge: "bg-amber-600 text-amber-50",
    },
  }[rank];

  return (
    <div
      ref={registerRef}
      className={cn(
        "relative overflow-hidden rounded-xl border bg-gradient-to-br p-4 transition-all hover:-translate-y-0.5 hover:shadow-md",
        tint.bg,
        isCurrentUser && "ring-2 ring-primary/60",
        rank === 1 && "ring-2",
        rank === 1 && tint.ring
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shadow-sm",
            tint.badge
          )}
        >
          {rank === 1 ? (
            <Trophy className="w-4 h-4" />
          ) : (
            <Medal className="w-4 h-4" />
          )}
        </div>
        <span className="text-xs font-mono text-muted-foreground">
          #{entry.rank}
        </span>
      </div>
      <div className="flex flex-col items-center text-center gap-2">
        <Avatar
          className={cn(
            "h-14 w-14 ring-2 ring-background shadow-sm",
            isCurrentUser && "ring-primary"
          )}
        >
          <AvatarImage src={entry.imageUrl ?? undefined} alt={name} />
          <AvatarFallback className="text-base font-semibold">
            {name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 w-full">
          <p
            className={cn(
              "text-sm font-semibold truncate",
              isCurrentUser && "text-primary"
            )}
            title={name}
          >
            {name}
            {isCurrentUser && (
              <span className="ml-1 text-xs text-primary/70">(You)</span>
            )}
          </p>
          <p className="text-2xl font-bold tabular-nums mt-1">{stat.value}</p>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
            {stat.label}
          </p>
        </div>
      </div>
    </div>
  );
}

function ListRow({
  entry,
  isCurrentUser,
  sortBy,
  registerRef,
}: {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
  sortBy: SortBy;
  registerRef?: (el: HTMLDivElement | null) => void;
}) {
  const name = displayName(entry);

  return (
    <div
      ref={registerRef}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border bg-card transition-colors",
        isCurrentUser && "bg-primary/5 border-primary/40 ring-1 ring-primary/30"
      )}
    >
      <div className="w-8 flex-shrink-0 text-center">
        <span className="text-sm font-mono font-semibold text-muted-foreground tabular-nums">
          #{entry.rank}
        </span>
      </div>
      <Avatar className="h-9 w-9 flex-shrink-0">
        <AvatarImage src={entry.imageUrl ?? undefined} alt={name} />
        <AvatarFallback className="text-xs font-medium">
          {name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium truncate",
            isCurrentUser && "text-primary"
          )}
          title={name}
        >
          {name}
          {isCurrentUser && (
            <span className="ml-1 text-xs opacity-70">(You)</span>
          )}
        </p>
        {/* Secondary stats row — appears under the name on mobile so we
            don't squeeze 3 stat columns into a 320px screen. */}
        <div className="flex items-center gap-3 mt-0.5 sm:hidden">
          <StatCell
            icon={Flame}
            value={entry.currentStreak}
            label="streak"
            emphasize={sortBy === "currentStreak"}
          />
          <StatCell
            icon={Target}
            value={`${entry.winRate.toFixed(0)}%`}
            label="win"
            emphasize={sortBy === "winRate"}
          />
          <StatCell
            icon={Hash}
            value={entry.totalWins}
            label="wins"
            emphasize={sortBy === "totalWins"}
          />
        </div>
      </div>
      {/* Desktop stat strip — explicit values, with the active sort
          subtly emphasized so the user can verify the ordering at a
          glance. */}
      <div className="hidden sm:flex items-center gap-4 flex-shrink-0">
        <StatCell
          icon={Flame}
          value={entry.currentStreak}
          label="streak"
          emphasize={sortBy === "currentStreak"}
        />
        <StatCell
          icon={Target}
          value={`${entry.winRate.toFixed(0)}%`}
          label="win"
          emphasize={sortBy === "winRate"}
        />
        <StatCell
          icon={Hash}
          value={entry.totalWins}
          label="wins"
          emphasize={sortBy === "totalWins"}
        />
        <StatCell
          icon={Zap}
          value={entry.averageAttempts.toFixed(2)}
          label="avg"
          emphasize={sortBy === "averageAttempts"}
        />
      </div>
    </div>
  );
}

function PodiumSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-xl border p-4 flex flex-col items-center gap-3"
        >
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="w-14 h-14 rounded-full" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

function ListSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-lg border bg-card"
        >
          <Skeleton className="w-6 h-4" />
          <Skeleton className="w-9 h-9 rounded-full" />
          <Skeleton className="h-4 flex-1 max-w-[180px]" />
          <div className="hidden sm:flex gap-4">
            <Skeleton className="w-10 h-3" />
            <Skeleton className="w-10 h-3" />
            <Skeleton className="w-10 h-3" />
            <Skeleton className="w-10 h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function GameLeaderboard({
  entries,
  loading,
  me,
  meLoading,
  currentUserId,
  sortBy,
  onSortByChange,
  timeWindow,
  onTimeWindowChange,
}: GameLeaderboardProps) {
  // Animate the freshly-fetched rows. We keep a ref to the parent grid
  // and re-stagger whenever (sortBy, timeWindow) changes — same UX as the
  // guess cards on the game page.
  const podiumRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (loading || entries.length === 0) return;
    let cancelled = false;
    loadGsap().then((gsap) => {
      if (cancelled) return;
      const podiumKids = podiumRef.current
        ? Array.from(podiumRef.current.children)
        : [];
      const listKids = listRef.current
        ? Array.from(listRef.current.children)
        : [];
      const all = [...podiumKids, ...listKids];
      if (all.length === 0) return;
      gsap.set(all, { opacity: 0, y: 8 });
      gsap.to(all, {
        opacity: 1,
        y: 0,
        duration: 0.4,
        ease: "power2.out",
        stagger: 0.04,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [entries, loading, sortBy, timeWindow]);

  const podium = entries.slice(0, 3);
  const list = entries.slice(3);

  // Decide whether to show the "you" pin row below the list. We only
  // show it when the user is signed in, ranked, and not already in the
  // visible top-N — anything else creates duplicate or noisy rows.
  const visibleUserIds = new Set(entries.map((e) => e.userId));
  const showSelfPin =
    !!currentUserId &&
    !!me &&
    me.rank !== null &&
    !visibleUserIds.has(currentUserId);

  // Empty state when the user is signed in but has never qualified.
  // Distinct from "no leaderboard data" — we know the board has people,
  // we just want to nudge them to play.
  const showSelfEmpty =
    !!currentUserId &&
    !!me &&
    me.rank === null &&
    me.totalGames === 0 &&
    entries.length > 0;

  const showWinRateNote = sortBy === "winRate" && !loading;

  return (
    <section
      aria-label="Game leaderboard"
      className="w-full max-w-6xl mt-6 rounded-xl border bg-card p-4 sm:p-6"
    >
      {/* Header */}
      <div className="flex flex-col gap-4 mb-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" aria-hidden />
            <h2 className="text-lg sm:text-xl font-semibold font-heading">
              Leaderboard
            </h2>
          </div>
          <SegmentedControl
            value={timeWindow}
            onChange={onTimeWindowChange}
            options={WINDOW_TABS}
            ariaLabel="Leaderboard time window"
          />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <SegmentedControl
            value={sortBy}
            onChange={onSortByChange}
            options={SORT_TABS}
            ariaLabel="Leaderboard sort"
          />
          {showWinRateNote && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="w-3.5 h-3.5" aria-hidden />
              Win rate ranks players with 5+ games.
            </span>
          )}
        </div>
      </div>

      {/* Podium */}
      {loading ? (
        <div className="mb-4">
          <PodiumSkeleton />
        </div>
      ) : podium.length > 0 ? (
        <div
          ref={podiumRef}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4"
        >
          {podium.map((entry) => (
            <PodiumCard
              key={entry.userId}
              entry={entry}
              rank={entry.rank as 1 | 2 | 3}
              isCurrentUser={!!currentUserId && entry.userId === currentUserId}
              sortBy={sortBy}
              registerRef={() => undefined}
            />
          ))}
        </div>
      ) : null}

      {/* List */}
      {loading ? (
        <ListSkeleton />
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 py-10 text-center">
          <Trophy className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm font-medium text-foreground/80">
            No players ranked yet
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {timeWindow === "today"
              ? "Be the first to play today's puzzle."
              : timeWindow === "week"
              ? "No qualifying games in the last 7 days."
              : "Be the first on the board!"}
          </p>
        </div>
      ) : list.length > 0 ? (
        <div ref={listRef} className="space-y-2">
          {list.map((entry) => (
            <ListRow
              key={entry.userId}
              entry={entry}
              isCurrentUser={!!currentUserId && entry.userId === currentUserId}
              sortBy={sortBy}
            />
          ))}
        </div>
      ) : null}

      {/* "You" pin — separate row at the bottom for off-board users.
          Mirrors the look of a list row but with a divider above so it
          reads as a separate band. */}
      {showSelfPin && me && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            Your position
          </p>
          <ListRow
            entry={{
              rank: me.rank!,
              userId: me.userId,
              username: me.username,
              firstName: me.firstName,
              lastName: me.lastName,
              imageUrl: me.imageUrl,
              totalGames: me.totalGames,
              totalWins: me.totalWins,
              winRate: me.winRate,
              currentStreak: me.currentStreak,
              longestStreak: me.longestStreak,
              averageAttempts: me.averageAttempts,
            }}
            isCurrentUser
            sortBy={sortBy}
          />
          {me.totalRanked > 0 && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Ranked {me.rank} of {me.totalRanked} players
            </p>
          )}
        </div>
      )}

      {/* Sign-in / no-qualifying-games nudge. */}
      {showSelfEmpty && (
        <div className="mt-4 pt-4 border-t text-center">
          <p className="text-sm text-muted-foreground">
            {timeWindow === "today"
              ? "Play today's puzzle to land on the board."
              : sortBy === "winRate"
              ? "Play 5+ games to qualify for the win-rate leaderboard."
              : "Play a game to land on the leaderboard."}
          </p>
        </div>
      )}

      {/* Tiny loading indicator for the per-user fetch — kept subtle so
          it doesn't compete with the main board. */}
      {meLoading && !showSelfPin && !showSelfEmpty && (
        <div className="mt-4 pt-4 border-t flex items-center justify-center">
          <Skeleton className="h-12 w-full max-w-md" />
        </div>
      )}
    </section>
  );
}
