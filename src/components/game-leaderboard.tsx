"use client";

import { Trophy, Flame } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { DailyEntry } from "@/components/game-leaderboard-section";

interface MeData {
  rank: number | null;
  played: boolean;
  currentStreak: number;
  neighbors: DailyEntry[];
}

interface GameLeaderboardProps {
  loading: boolean;
  entries: DailyEntry[];
  totalPlayers: number;
  currentUserId?: string;
  isSignedIn: boolean;
  me: MeData | null;
}

const MAX_ATTEMPTS = 4;

function displayName(
  e: Pick<DailyEntry, "username" | "firstName" | "lastName">
): string {
  return (
    e.username ||
    `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim() ||
    "Anonymous"
  );
}

// Wordle-style score chip. The single most useful piece of info: did
// they get it, and in how many tries. Hints are factored into the
// underlying ranking but deliberately not surfaced as a separate column —
// every extra column makes the row harder to scan.
function ScoreChip({ entry }: { entry: DailyEntry }) {
  if (!entry.won) {
    return (
      <span
        className="inline-flex items-center justify-center w-9 h-7 rounded-md text-xs font-bold tabular-nums bg-red-500/10 text-red-600 dark:text-red-400"
        title="Did not solve"
      >
        X
      </span>
    );
  }
  // 1/4 = great (green), 2/4 = good, 3/4 = ok, 4/4 = squeaked it
  const tone =
    entry.attempts === 1
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : entry.attempts === 2
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : entry.attempts === 3
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
      : "bg-zinc-500/10 text-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-9 h-7 rounded-md text-xs font-bold tabular-nums",
        tone
      )}
      title={
        entry.hintsUsed > 0
          ? `Solved in ${entry.attempts}/${MAX_ATTEMPTS} with ${entry.hintsUsed} hint${
              entry.hintsUsed === 1 ? "" : "s"
            }`
          : `Solved in ${entry.attempts}/${MAX_ATTEMPTS}`
      }
    >
      {entry.attempts}/{MAX_ATTEMPTS}
    </span>
  );
}

function StreakBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold bg-orange-500/10 text-orange-600 dark:text-orange-400"
      title={`${count}-day winning streak`}
    >
      <Flame className="w-3 h-3" aria-hidden />
      {count}
    </span>
  );
}

function EntryRow({
  entry,
  isCurrentUser,
  streak,
}: {
  entry: DailyEntry;
  isCurrentUser: boolean;
  streak?: number;
}) {
  const name = displayName(entry);
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
        isCurrentUser ? "bg-primary/10" : "hover:bg-muted/40"
      )}
    >
      <span className="w-7 text-right text-sm font-medium text-muted-foreground tabular-nums">
        {entry.rank}
      </span>
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={entry.imageUrl ?? undefined} alt={name} />
        <AvatarFallback className="text-xs font-medium">
          {name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span
          className={cn(
            "text-sm truncate",
            isCurrentUser ? "font-semibold text-primary" : "text-foreground"
          )}
          title={name}
        >
          {isCurrentUser ? "You" : name}
        </span>
        {isCurrentUser && streak !== undefined && <StreakBadge count={streak} />}
      </div>
      <ScoreChip entry={entry} />
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <Skeleton className="w-6 h-4" />
      <Skeleton className="w-8 h-8 rounded-full" />
      <Skeleton className="h-4 flex-1 max-w-[160px]" />
      <Skeleton className="w-9 h-7 rounded-md" />
    </div>
  );
}

export function GameLeaderboard({
  loading,
  entries,
  totalPlayers,
  currentUserId,
  isSignedIn,
  me,
}: GameLeaderboardProps) {
  // The single rule for whether to render the sandwich: caller is signed
  // in, played today, and is past the visible top. Anything else and we
  // just show a plain top-N — no divider, no duplicate rows.
  const showSandwich =
    !!me && me.played && me.rank !== null && me.rank > 5;

  // Top section. We show 3 rows when sandwiching to keep the card
  // height bounded; otherwise show 7 so a "near top" player still sees
  // some of the field below them.
  const topRows = showSandwich ? entries.slice(0, 3) : entries.slice(0, 7);

  // Empty state branch — kept above the skeleton check because while
  // loading we never want to flash "no players yet".
  const isEmpty = !loading && totalPlayers === 0;

  return (
    <section
      aria-label="Today's leaderboard"
      className="w-full max-w-2xl mx-auto mt-6 rounded-xl border bg-card"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-500" aria-hidden />
          <h2 className="text-sm font-semibold font-heading">
            Today&apos;s leaderboard
          </h2>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {loading ? (
            <Skeleton className="inline-block h-3 w-20" />
          ) : totalPlayers === 1 ? (
            "1 player"
          ) : (
            `${totalPlayers.toLocaleString()} players`
          )}
        </span>
      </div>

      <div className="p-2">
        {loading ? (
          <div className="space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <RowSkeleton key={i} />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="py-10 text-center">
            <Trophy className="w-7 h-7 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium text-foreground/80">
              No one&apos;s played yet today
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Be the first to land on the board.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              {topRows.map((entry) => {
                const isMe =
                  !!currentUserId && entry.userId === currentUserId;
                return (
                  <EntryRow
                    key={entry.userId}
                    entry={entry}
                    isCurrentUser={isMe}
                    streak={isMe ? me?.currentStreak : undefined}
                  />
                );
              })}
            </div>

            {showSandwich && me && (
              <>
                {/* Visual gap between top and the user's neighborhood.
                    The dotted ellipsis communicates "there's more
                    between these two sections" without us having to
                    fetch and render the missing rows. */}
                <div
                  className="flex items-center justify-center py-2"
                  aria-hidden
                >
                  <span className="text-muted-foreground/50 text-xs tracking-widest">
                    • • •
                  </span>
                </div>
                <div className="space-y-1">
                  {me.neighbors.map((entry) => {
                    const isMe =
                      !!currentUserId && entry.userId === currentUserId;
                    return (
                      <EntryRow
                        key={entry.userId}
                        entry={entry}
                        isCurrentUser={isMe}
                        streak={isMe ? me.currentStreak : undefined}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Footer nudges. One line, one job — keep the card from feeling
          dead-end for users who can't yet see themselves on it. */}
      {!loading && (
        <FooterNudge
          isSignedIn={isSignedIn}
          me={me}
          totalPlayers={totalPlayers}
        />
      )}
    </section>
  );
}

function FooterNudge({
  isSignedIn,
  me,
  totalPlayers,
}: {
  isSignedIn: boolean;
  me: MeData | null;
  totalPlayers: number;
}) {
  if (totalPlayers === 0) return null;

  if (!isSignedIn) {
    return (
      <p className="px-4 py-3 border-t text-xs text-muted-foreground text-center">
        Sign in to track your streak and rank.
      </p>
    );
  }
  if (me && !me.played) {
    return (
      <p className="px-4 py-3 border-t text-xs text-muted-foreground text-center">
        Play today&apos;s puzzle to land on the board.
      </p>
    );
  }
  // Signed in + played + in top → no footer needed; the row's already
  // highlighted above.
  return null;
}
