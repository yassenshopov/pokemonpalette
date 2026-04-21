"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

export default function ShinyPokemonError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("pokemon.shiny_page_error", {
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
        Couldn&apos;t load the shiny palette
      </h1>
      <p className="text-muted-foreground">
        The shiny artwork failed to load. Try again, or view the normal
        variant.
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
