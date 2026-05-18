"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GameLeaderboardSection } from "@/components/game-leaderboard-section";
import type { Difficulty } from "@/lib/game/similarity";

interface GameLeaderboardDialogProps {
  /**
   * Which daily track to show. Each (date, difficulty) has its own
   * ranking so a player's hard-mode standings don't get mixed into
   * the historical easy-mode board. Defaults to `"easy"` so older
   * callers that haven't been threaded through stay on the legacy
   * board.
   */
  difficulty?: Difficulty;
}

// Trigger + Dialog wrapper around <GameLeaderboardSection embedded />.
//
// The leaderboard used to live as an always-rendered band at the bottom
// of the game page. That meant every visit cost a fetch (now two with
// /me), and the player had to scroll past the search/guess UI to see
// it. Moving it behind a button:
//   * Pushes the network requests into actual user intent — the dialog
//     contents only mount when the dialog opens, so signed-out users
//     who never click pay nothing.
//   * Keeps the action row focused on per-game actions (Give Up, etc.)
//     while still surfacing the leaderboard one click away.
//
// The `embedded` flag on the section tells <GameLeaderboard /> to drop
// its outer card chrome — DialogContent already supplies a border,
// background, padding, and rounded corners.
export function GameLeaderboardDialog({
  difficulty = "easy",
}: GameLeaderboardDialogProps = {}) {
  const [open, setOpen] = useState(false);

  // We hide the visible <DialogTitle> because the section already
  // renders its own header ("Today's leaderboard"). Radix still
  // requires a DialogTitle for screen-readers, so we provide one and
  // mark it sr-only.
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          track("leaderboard_dialog_opened", { difficulty });
        }
      }}
    >
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="cursor-pointer"
        aria-label="Open today's leaderboard"
      >
        <Trophy className="w-4 h-4 mr-2" aria-hidden />
        Leaderboard
      </Button>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader className="sr-only">
          <DialogTitle>Today&apos;s leaderboard</DialogTitle>
        </DialogHeader>
        {/* `embedded` collapses the inner card chrome so DialogContent
            owns the visual surface. The section internally lazy-mounts
            its data fetches via useEffect, which only runs once the
            dialog actually opens (this component isn't mounted until
            the page renders it, but the section's effects fire on
            mount — fine because the dialog is dynamic-imported on the
            page side). */}
        <GameLeaderboardSection embedded difficulty={difficulty} />
      </DialogContent>
    </Dialog>
  );
}
