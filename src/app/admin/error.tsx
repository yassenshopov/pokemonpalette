"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("admin.page_error", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main
      id="main"
      className="container mx-auto px-6 py-12 flex flex-col gap-4 max-w-xl"
    >
      <h1 className="text-2xl font-heading font-semibold">
        Admin console error
      </h1>
      <p className="text-muted-foreground">
        A dashboard query failed. Your admin session is still valid. Check the
        Vercel logs (reference below) if this persists.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => reset()}>Retry</Button>
        <Button variant="outline" asChild>
          <Link href="/admin">Back to overview</Link>
        </Button>
      </div>
      {error.digest && (
        <p className="text-xs font-mono text-muted-foreground">
          Reference: {error.digest}
        </p>
      )}
    </main>
  );
}
