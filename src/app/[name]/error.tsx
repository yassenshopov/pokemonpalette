"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

export default function PokemonError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("pokemon.page_error", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main
      id="main"
      className="container mx-auto px-4 py-16 text-center space-y-4"
    >
      <h1 className="text-2xl font-heading font-semibold">
        Couldn&apos;t load that Pokémon
      </h1>
      <p className="text-muted-foreground">
        The artwork or palette data failed to load. Try again, or browse from
        the home page.
      </p>
      <div className="flex gap-2 justify-center">
        <Button onClick={() => reset()}>Retry</Button>
        <Button variant="outline" asChild>
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </main>
  );
}
