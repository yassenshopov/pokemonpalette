"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

/**
 * Root error boundary. Catches anything thrown in a server component, route
 * handler (wrapped to throw), or client-side render below the root layout
 * and renders a recoverable UI rather than Next's default stacktrace page.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // digest is the hash Next attaches to server-side errors so we can
    // correlate this client render with Vercel logs.
    logger.error("app.root_error", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main
      id="main"
      className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
    >
      <div className="max-w-md space-y-4">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">
          Something went wrong
        </p>
        <h1 className="text-3xl font-heading font-semibold">
          We hit an unexpected error.
        </h1>
        <p className="text-muted-foreground">
          The issue has been logged. You can try again — most of the time this
          clears on a refresh.
        </p>
        <div className="flex gap-2 justify-center pt-4">
          <Button onClick={() => reset()}>Try again</Button>
          <Button variant="outline" asChild>
            <Link href="/">Go home</Link>
          </Button>
        </div>
        {error.digest && (
          <p className="text-xs text-muted-foreground pt-4 font-mono">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
