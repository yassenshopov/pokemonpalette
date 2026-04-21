"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

export default function GameError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("game.page_error", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main
      id="main"
      className="container mx-auto px-4 py-16 flex flex-col items-center gap-4 text-center"
    >
      <h1 className="text-2xl font-heading font-semibold">
        The game ran into an issue.
      </h1>
      <p className="text-muted-foreground max-w-md">
        Your in-progress guesses are saved locally — refreshing or retrying
        shouldn&apos;t cost you a streak.
      </p>
      <Button onClick={() => reset()}>Retry</Button>
    </main>
  );
}
