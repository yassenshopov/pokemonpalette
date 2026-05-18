"use client";

import { useState } from "react";
import Link from "next/link";
import { Globe, Copy, Check, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";

interface PublicProfileCardProps {
  /** Clerk username, if claimed. Null if user hasn't set one yet. */
  username: string | null;
}

/**
 * Surfaces the user's public Pokédex URL on /account so they discover
 * the `/u/[username]` profile feature and can share it. If they haven't
 * claimed a Clerk username yet we explain how — the form to set one
 * already lives inside Clerk's `<UserProfile>` widget which is rendered
 * elsewhere on the same screen.
 */
export function PublicProfileCard({ username }: PublicProfileCardProps) {
  const [copied, setCopied] = useState(false);

  if (!username) {
    return (
      <section className="mb-6 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-dashed bg-card/60 p-4 sm:p-5 flex items-start gap-3">
          <div className="shrink-0 rounded-lg bg-muted/60 p-2">
            <UserPlus
              className="w-5 h-5 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold font-heading text-sm">
              Claim your public profile
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-snug">
              Set a username in your account settings above to get a
              shareable Pokédex at{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                pokemonpalette.com/u/your-name
              </code>
              .
            </p>
          </div>
        </div>
      </section>
    );
  }

  const profilePath = `/u/${username}`;
  const profileFullUrl = `https://www.pokemonpalette.com${profilePath}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(profileFullUrl);
      setCopied(true);
      track("profile_link_copied", { source: "account" });
      // Reset after 2s so a second copy still gives feedback.
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without async clipboard — select the URL
      // text. Niche enough that silent failure is acceptable; the link
      // is also visible inline for the user to copy manually.
    }
  };

  return (
    <section className="mb-6 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="shrink-0 rounded-lg bg-primary/10 p-2">
              <Globe className="w-5 h-5 text-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold font-heading text-sm">
                Your public Pokédex
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Anyone with the link can see your catches, streak, and
                badges. Share it with friends.
              </p>
              <p className="mt-2 text-xs font-mono truncate text-foreground/90">
                {profileFullUrl}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopy}
              className="h-9 px-3 cursor-pointer"
              aria-label="Copy public profile URL"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-1.5" aria-hidden="true" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1.5" aria-hidden="true" />
                  Copy link
                </>
              )}
            </Button>
            <Button
              size="sm"
              asChild
              className="h-9 px-3 cursor-pointer"
              onClick={() =>
                track("profile_visited_from_account", { source: "account" })
              }
            >
              <Link href={profilePath} prefetch>
                View
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
