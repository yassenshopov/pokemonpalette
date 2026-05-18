/**
 * Public Pokédex profile at `/u/[username]`.
 *
 * Goals:
 *   - Give every signed-in user with a Clerk username a shareable
 *     profile URL → loops "I caught X today" social sharing back to the
 *     domain instead of an external screenshot.
 *   - Give Google a stable, lightly-stateful URL family it can crawl
 *     (we expose noindex via the metadata helper for now until volume
 *     justifies indexing them, but the page itself is fully renderable
 *     server-side so previews work for sharing).
 *
 * Privacy model (MVP):
 *   - A user is publicly visible iff they have a Clerk username set and
 *     are not soft-deleted. Clerk usernames are user-chosen, so claiming
 *     one is the opt-in signal.
 *   - We do NOT expose: email, Clerk ID, IP/geo, settings.
 *   - Visible payload is restricted to: username, image, member-since
 *     date, public play stats, recent Pokédex catches.
 *   - Future: explicit `publicMetadata.profilePublic = false` opt-out.
 *     Wired into the lookup below as a defensive check so the toggle
 *     can ship in a follow-up without breaking anyone's URL.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { getPokemonMetadataById } from "@/lib/pokemon";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { Footer } from "@/components/footer";
import { JsonLd, breadcrumbSchema } from "@/components/structured-data";
import { Trophy, Flame, Sparkles, Calendar } from "lucide-react";
import { logger } from "@/lib/logger";

const SITE_URL = "https://www.pokemonpalette.com";
const SHOWN_CATCHES = 60;

// -----------------------------------------------------------------------------
// Lookup
// -----------------------------------------------------------------------------

interface PublicProfile {
  id: string;
  username: string;
  imageUrl: string | null;
  memberSince: Date;
}

/**
 * Resolve a user by username (case-insensitive). Returns null on
 * deleted users, missing usernames, or an explicit opt-out flag.
 */
async function findPublicProfile(
  username: string,
): Promise<PublicProfile | null> {
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    // Usernames are constrained by Clerk to alphanumerics + `_` / `-`.
    // Anything else can only come from a hand-crafted URL; reject early
    // to avoid a wildcard DB query.
    return null;
  }

  const user = await prisma.user.findFirst({
    where: {
      username: { equals: username, mode: "insensitive" },
      isDeleted: false,
    },
    select: {
      id: true,
      username: true,
      imageUrl: true,
      profileImageUrl: true,
      createdAt: true,
      publicMetadata: true,
    },
  });
  if (!user || !user.username) return null;

  // Defensive: future opt-out path. publicMetadata is a JSON column so
  // the runtime shape is wide — narrow conservatively.
  const meta = user.publicMetadata as Prisma.JsonValue;
  if (
    meta &&
    typeof meta === "object" &&
    !Array.isArray(meta) &&
    (meta as Record<string, unknown>).profilePublic === false
  ) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    imageUrl: user.imageUrl ?? user.profileImageUrl ?? null,
    memberSince: user.createdAt,
  };
}

// -----------------------------------------------------------------------------
// Metadata
// -----------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await findPublicProfile(username);
  if (!profile) {
    return {
      title: "Trainer not found | PokémonPalette",
      robots: { index: false, follow: false },
    };
  }

  const canonical = `${SITE_URL}/u/${profile.username}`;
  const title = `@${profile.username} — Trainer profile | PokémonPalette`;
  const description = `${profile.username}'s public Pokédex on PokémonPalette — daily palette-guessing streaks, catches, and badges.`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "profile",
      siteName: "PokémonPalette",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    // MVP: keep public profiles out of the index until we've seen the
    // shape work for a handful of users. They're still discoverable via
    // direct link / social share, just not via Google.
    robots: { index: false, follow: true },
  };
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

interface RecentCatch {
  pokemonId: number;
  pokemonName: string;
  primaryType: string;
  isShiny: boolean;
  caughtAt: Date;
}

interface ProfileStats {
  pokedexTotal: number;
  shinyTotal: number;
  currentStreak: number;
  longestStreak: number;
  totalGames: number;
  totalWins: number;
}

async function loadProfilePayload(
  userId: string,
): Promise<{ stats: ProfileStats; recent: RecentCatch[] }> {
  const [pokedexTotal, shinyTotal, recentEntries, rpcRes] = await Promise.all([
    prisma.pokedexEntry.count({ where: { userId } }),
    prisma.pokedexEntry.count({ where: { userId, isShiny: true } }),
    prisma.pokedexEntry.findMany({
      where: { userId },
      orderBy: { caughtAt: "desc" },
      take: SHOWN_CATCHES,
      select: { pokemonId: true, isShiny: true, caughtAt: true },
    }),
    // Public profile shows the legacy easy-mode totals so the numbers
    // here stay continuous with what these users have already accumulated.
    // Hard-mode breakdowns belong on the player's own account page where
    // we have room for a toggle.
    supabaseAdmin.rpc("user_game_stats", {
      p_user_id: userId,
      p_difficulty: "easy",
    }),
  ]);

  if (rpcRes.error) {
    logger.warn("public-profile.stats_rpc_failed", {
      userId,
      error: rpcRes.error.message,
    });
  }
  const statsRaw = (rpcRes.data ?? {}) as Partial<{
    currentStreak: number;
    longestStreak: number;
    totalGames: number;
    totalWins: number;
  }>;

  const recent: RecentCatch[] = recentEntries
    .map((e) => {
      const meta = getPokemonMetadataById(e.pokemonId);
      if (!meta) return null;
      return {
        pokemonId: e.pokemonId,
        pokemonName: meta.name,
        primaryType: meta.type[0] ?? "Unknown",
        isShiny: e.isShiny,
        caughtAt: e.caughtAt,
      };
    })
    .filter((entry): entry is RecentCatch => entry !== null);

  return {
    stats: {
      pokedexTotal,
      shinyTotal,
      currentStreak: Number(statsRaw.currentStreak ?? 0),
      longestStreak: Number(statsRaw.longestStreak ?? 0),
      totalGames: Number(statsRaw.totalGames ?? 0),
      totalWins: Number(statsRaw.totalWins ?? 0),
    },
    recent,
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await findPublicProfile(username);
  if (!profile) {
    notFound();
  }

  const { stats, recent } = await loadProfilePayload(profile.id);

  const winRate =
    stats.totalGames > 0
      ? Math.round((stats.totalWins / stats.totalGames) * 100)
      : 0;
  const canonical = `${SITE_URL}/u/${profile.username}`;
  const memberSinceLabel = profile.memberSince.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            mainEntity: {
              "@type": "Person",
              name: profile.username,
              alternateName: `@${profile.username}`,
              url: canonical,
              image: profile.imageUrl ?? undefined,
            },
          },
          breadcrumbSchema([
            { name: "Home", url: SITE_URL },
            {
              name: `@${profile.username}`,
              url: canonical,
            },
          ]),
        ]}
      />
      <div className="flex h-screen overflow-hidden">
        <CollapsibleSidebar />
        <div className="flex-1 flex flex-col h-full overflow-y-auto">
          <main id="main" className="flex-1">
            {/* Hero */}
            <section className="border-b">
              <div className="container mx-auto px-4 md:px-6 py-10 md:py-14 max-w-5xl">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                  Trainer profile
                </p>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                  {profile.imageUrl ? (
                    <Image
                      src={profile.imageUrl}
                      alt={`${profile.username} avatar`}
                      width={88}
                      height={88}
                      className="rounded-2xl border bg-muted/40"
                      // Off-domain Clerk asset; Next-Image can't optimize
                      // it without a remotePatterns entry. Skip the
                      // optimizer to avoid a 502 + ship the source PNG.
                      unoptimized
                    />
                  ) : (
                    <div className="size-[88px] rounded-2xl border bg-muted/40 flex items-center justify-center text-3xl font-bold font-heading text-muted-foreground">
                      {profile.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h1 className="text-3xl md:text-4xl font-bold font-heading">
                      @{profile.username}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                      Member since {memberSinceLabel}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Stat grid */}
            <section className="border-b bg-muted/10">
              <div className="container mx-auto px-4 md:px-6 py-8 max-w-5xl">
                <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatTile
                    icon={Trophy}
                    label="Pokédex"
                    value={stats.pokedexTotal.toLocaleString()}
                    sublabel="caught"
                    accent="text-emerald-500"
                  />
                  <StatTile
                    icon={Flame}
                    label="Streak"
                    value={`${stats.currentStreak}d`}
                    sublabel={`best ${stats.longestStreak}d`}
                    accent="text-orange-500"
                  />
                  <StatTile
                    icon={Sparkles}
                    label="Shiny"
                    value={stats.shinyTotal.toLocaleString()}
                    sublabel="caught"
                    accent="text-fuchsia-500"
                  />
                  <StatTile
                    icon={Trophy}
                    label="Win rate"
                    value={`${winRate}%`}
                    sublabel={`${stats.totalWins} / ${stats.totalGames}`}
                    accent="text-sky-500"
                  />
                </dl>
              </div>
            </section>

            {/* Recent catches */}
            <section className="border-b">
              <div className="container mx-auto px-4 md:px-6 py-10 max-w-5xl">
                <div className="flex items-end justify-between gap-3 mb-6 flex-wrap">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold font-heading">
                      Recent catches
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {recent.length === 0
                        ? "No catches yet."
                        : `Showing the ${recent.length} most recent of ${stats.pokedexTotal.toLocaleString()}.`}
                    </p>
                  </div>
                </div>
                {recent.length === 0 ? (
                  <div className="rounded-xl border bg-card p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      This trainer hasn&apos;t caught anything yet — come
                      back later or{" "}
                      <Link
                        href="/game"
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        play the daily game
                      </Link>{" "}
                      to start your own Pokédex.
                    </p>
                  </div>
                ) : (
                  <ul className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3">
                    {recent.map((c) => (
                      <li key={`${c.pokemonId}-${c.isShiny ? "s" : "n"}`}>
                        <Link
                          href={`/${c.pokemonName.toLowerCase()}`}
                          className="group block rounded-xl border bg-card p-2 hover:border-foreground/30 transition-colors"
                        >
                          <div className="relative aspect-square overflow-hidden rounded-lg bg-muted/40">
                            <Image
                              src={
                                c.isShiny
                                  ? `/pokemon/sprites/shiny/${c.pokemonId}.png`
                                  : `/pokemon/sprites/${c.pokemonId}.png`
                              }
                              alt={`${c.pokemonName}${c.isShiny ? " (shiny)" : ""} sprite`}
                              fill
                              sizes="(max-width: 768px) 25vw, 12vw"
                              className="object-contain p-2 group-hover:scale-105 transition-transform"
                              unoptimized
                            />
                            {c.isShiny && (
                              <span
                                aria-hidden="true"
                                className="absolute top-1 right-1 text-fuchsia-500"
                                title="Shiny"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-center text-[11px] sm:text-xs font-medium font-heading capitalize truncate">
                            {c.pokemonName}
                          </p>
                          <p className="text-center text-[10px] text-muted-foreground capitalize">
                            #{String(c.pokemonId).padStart(3, "0")}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* CTA — drive viewers into the funnel */}
            <section className="border-b">
              <div className="container mx-auto px-4 md:px-6 py-12 max-w-3xl text-center">
                <h2 className="text-2xl md:text-3xl font-bold font-heading">
                  Build your own Pokédex
                </h2>
                <p className="mt-3 text-muted-foreground">
                  Play the daily palette-guessing game, catch the
                  Pokémon you solve, and earn badges as your streak
                  grows.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/game?utm_source=u-profile&utm_medium=cta&utm_campaign=public_profile"
                    prefetch
                    className="inline-flex h-11 items-center justify-center rounded-md bg-primary text-primary-foreground px-6 text-sm font-semibold hover:bg-primary/90"
                  >
                    Play today&apos;s puzzle
                  </Link>
                  <Link
                    href="/guess-the-pokemon"
                    className="inline-flex h-11 items-center justify-center rounded-md border px-6 text-sm font-medium hover:bg-muted"
                  >
                    How it works
                  </Link>
                </div>
              </div>
            </section>

            <Footer />
          </main>
        </div>
      </div>
    </>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  sublabel,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sublabel?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <Icon
        className={`w-5 h-5 mb-2 ${accent ?? "text-foreground"}`}
        aria-hidden="true"
      />
      <dt className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </dt>
      <dd className="mt-0.5 text-2xl font-bold font-heading tabular-nums">
        {value}
      </dd>
      {sublabel && (
        <p className="text-[11px] text-muted-foreground mt-0.5">{sublabel}</p>
      )}
    </div>
  );
}
