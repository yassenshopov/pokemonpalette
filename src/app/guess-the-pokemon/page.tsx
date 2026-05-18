import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import {
  JsonLd,
  breadcrumbSchema,
  gameSchema,
  howToPlaySchema,
} from "@/components/structured-data";
import { Calendar, Infinity as InfinityIcon, Users, Trophy } from "lucide-react";

const SITE_URL = "https://www.pokemonpalette.com";

/**
 * "Guess the Pokémon" is one of the highest-impression queries we rank on
 * (position-7 over 609k impressions in the last 90 days, per Search
 * Console). The `/game` route is the destination but its meta is
 * primarily "Pokémon Color Guessing Game" — a different lexical match.
 *
 * This page is a dedicated landing for the exact "guess the pokemon"
 * keyword, with rich content + `VideoGame` + `HowTo` schemas to make the
 * page eligible for game and how-to rich results. Internal-linking
 * structure points downstream to `/game`, `/account`, and `/explore`.
 */
export const metadata: Metadata = {
  title:
    "Guess the Pokémon — Daily Color Palette Game | PokémonPalette",
  description:
    "Guess the Pokémon from its color palette. Free daily puzzle, unlimited mode, and head-to-head multiplayer — no signup, no ads in the playfield. Four attempts, three optional hints. New region every week.",
  keywords: [
    "guess the pokemon",
    "guess the pokemon game",
    "pokemon guessing game",
    "guess pokemon by color",
    "daily pokemon game",
    "pokemon wordle",
    "pokemon trivia",
    "pokemon color quiz",
  ],
  openGraph: {
    title: "Guess the Pokémon — Daily Color Palette Game",
    description:
      "Guess the Pokémon from its color palette. New puzzle every day, unlimited mode, and multiplayer. Free to play.",
    url: `${SITE_URL}/guess-the-pokemon`,
    siteName: "PokémonPalette",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Guess the Pokémon — color palette game",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Guess the Pokémon — Daily Color Palette Game",
    description:
      "Guess the Pokémon from its color palette. Free daily puzzle, unlimited mode, multiplayer.",
    images: ["/twitter-image.png"],
    creator: "@yassenshopov",
  },
  alternates: {
    canonical: `${SITE_URL}/guess-the-pokemon`,
  },
};

const BW2_SPRITE = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${id}.gif`;

/**
 * Six fixed sample puzzles. Curated for vibrant, recognizable palettes so
 * a player skimming the page can intuit "I could play this" within a
 * couple seconds — and so the page has real visual content for Google to
 * crawl above the fold.
 *
 * Each entry shows the palette + the answer underneath so the page reads
 * as a self-contained demo, not a paywall.
 */
const SAMPLE_PUZZLES: ReadonlyArray<{
  id: number;
  name: string;
  type: string;
  palette: readonly [string, string, string];
}> = [
  {
    id: 6,
    name: "Charizard",
    type: "Fire / Flying",
    palette: ["#ee8329", "#cd5241", "#084152"] as const,
  },
  {
    id: 94,
    name: "Gengar",
    type: "Ghost / Poison",
    palette: ["#9473b4", "#5a4a9c", "#b48bbd"] as const,
  },
  {
    id: 25,
    name: "Pikachu",
    type: "Electric",
    palette: ["#f6e652", "#f6bd20", "#9c5200"] as const,
  },
  {
    id: 197,
    name: "Umbreon",
    type: "Dark",
    palette: ["#414152", "#29314a", "#62627b"] as const,
  },
  {
    id: 130,
    name: "Gyarados",
    type: "Water / Flying",
    palette: ["#1862a5", "#5293c5", "#cda431"] as const,
  },
  {
    id: 282,
    name: "Gardevoir",
    type: "Psychic / Fairy",
    palette: ["#eeeeff", "#cdcde6", "#8be68b"] as const,
  },
];

const FEATURES: ReadonlyArray<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}> = [
  {
    icon: Calendar,
    title: "A new puzzle every day",
    body: "One target Pokémon per UTC day, identical for every player. Each week rotates through a different region — Johto, Hoenn, Sinnoh, and on through Paldea — so the daily challenge stays fresh.",
  },
  {
    icon: InfinityIcon,
    title: "Unlimited mode for practice",
    body: "Burn through hundreds of palettes back-to-back. Pick the generations and shiny preference you want, and grind until your guesses feel automatic.",
  },
  {
    icon: Users,
    title: "Head-to-head multiplayer",
    body: "Share a room code with a friend. Same target, same hints, race to the right answer. No accounts needed.",
  },
  {
    icon: Trophy,
    title: "Streaks, Pokédex, badges",
    body: "Sign in to track your daily streak, catch every Pokémon you've solved into a personal Pokédex, and unlock badges for milestones.",
  },
];

const FAQ: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: "Is this game free?",
    a: "Yes. The daily game, unlimited mode, multiplayer, your Pokédex, and your streak history are all free. There are no ads in the playfield. We sustain the project with optional supporter tips and a paid API for developers.",
  },
  {
    q: "How does the color palette work?",
    a: "Every Pokémon's official artwork has been processed to extract the three to five most dominant colors. That palette is what you see at the top of each puzzle — your job is to identify the Pokémon that matches.",
  },
  {
    q: "How many attempts do I get?",
    a: "Four guesses per puzzle. After each guess you see how close your guess's palette is to the target, plus type and generation hints if you reveal them.",
  },
  {
    q: "Do I need an account?",
    a: "No. You can play every mode signed out. Signing in (free) unlocks daily streak tracking, a synced Pokédex, the multiplayer name display, and badges.",
  },
  {
    q: "Which Pokémon are included?",
    a: "All 1,025 Pokémon from Generations 1 through 9. The daily mode cycles through regions weekly so you'll see fresh picks; unlimited mode lets you select exactly which generations to draw from.",
  },
  {
    q: "What's the difference between this and Pokédle / Squirdle?",
    a: "PokémonPalette is the only daily Pokémon game that scores you on the visual palette of the target — every other Pokémon-Wordle variant scores typing, generation, or stats. The color hook is what makes this one feel different.",
  },
];

export default function GuessThePokemonPage() {
  return (
    <>
      <JsonLd
        data={[
          gameSchema(),
          howToPlaySchema(),
          breadcrumbSchema([
            { name: "Home", url: SITE_URL },
            {
              name: "Guess the Pokémon",
              url: `${SITE_URL}/guess-the-pokemon`,
            },
          ]),
          // FAQPage schema covers the bottom section — earns FAQ-rich
          // results in Google for the exact "guess the pokemon" query.
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: {
                "@type": "Answer",
                text: item.a,
              },
            })),
          },
        ]}
      />
      <div className="flex h-screen overflow-hidden">
        <CollapsibleSidebar />
        <div className="flex-1 flex flex-col h-full overflow-y-auto">
          <main id="main" className="flex-1">
            {/* Hero */}
            <section className="border-b">
              <div className="container mx-auto px-4 md:px-6 py-16 md:py-24 max-w-5xl">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
                  Daily color palette game · Free to play
                </p>
                <h1 className="text-4xl md:text-6xl font-bold font-heading tracking-tight">
                  Guess the Pokémon
                  <br />
                  <span className="text-muted-foreground">
                    from its color palette.
                  </span>
                </h1>
                <p className="mt-6 text-lg text-muted-foreground max-w-2xl leading-relaxed">
                  A new puzzle every day. Four guesses, three optional hints,
                  one target Pokémon. Play through all 1,025 Pokémon from
                  Kanto to Paldea — the daily region rotates every week.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Button
                    size="lg"
                    className="h-12 px-6 text-base font-semibold"
                    asChild
                  >
                    <Link
                      href="/game?utm_source=guess-the-pokemon&utm_medium=hero&utm_campaign=landing"
                      prefetch
                    >
                      Play today&apos;s puzzle
                    </Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 px-6 text-base"
                    asChild
                  >
                    <Link href="#how-it-works">How it works</Link>
                  </Button>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  No signup required · No ads in the game · ~2 min per puzzle
                </p>
              </div>
            </section>

            {/* Sample puzzles */}
            <section className="border-b bg-muted/10">
              <div className="container mx-auto px-4 md:px-6 py-16 max-w-5xl">
                <div className="mb-8">
                  <h2 className="text-2xl md:text-3xl font-bold font-heading">
                    What a puzzle looks like
                  </h2>
                  <p className="text-muted-foreground mt-2 max-w-2xl">
                    Each row shows the dominant palette of a Pokémon. In the
                    real game these come first — you guess before you see the
                    answer. We&apos;ve revealed all six below so you can get a
                    feel for the shape of the challenge.
                  </p>
                </div>
                <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {SAMPLE_PUZZLES.map((p) => (
                    <li
                      key={p.id}
                      className="rounded-xl border bg-card overflow-hidden"
                    >
                      <div className="flex h-16">
                        {p.palette.map((hex) => (
                          <div
                            key={hex}
                            className="flex-1"
                            style={{ backgroundColor: hex }}
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                      <div className="p-4 flex items-center gap-3">
                        <div className="shrink-0 rounded-lg bg-muted/40 p-1">
                          <Image
                            src={BW2_SPRITE(p.id)}
                            alt={`${p.name} sprite`}
                            width={48}
                            height={48}
                            unoptimized
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm font-heading">
                            {p.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {p.type} · #{String(p.id).padStart(3, "0")}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* How it works */}
            <section id="how-it-works" className="border-b">
              <div className="container mx-auto px-4 md:px-6 py-16 max-w-3xl">
                <h2 className="text-2xl md:text-3xl font-bold font-heading mb-8">
                  How to play
                </h2>
                <ol className="space-y-6">
                  {[
                    {
                      title: "Read the palette",
                      body: "The colors at the top of the page are the dominant hues from the target Pokémon's artwork. Three to five swatches, sorted by how much of the sprite each color covers.",
                    },
                    {
                      title: "Make your first guess",
                      body: "Type any Pokémon name. The game scores how close your guess's palette is to the target — green for very close, red for far off, with everything in between.",
                    },
                    {
                      title: "Use feedback to narrow down",
                      body: "After each guess you see whether your guess shares a type, generation, or evolution line with the target. The feedback compounds — three guesses in, you usually have a strong shortlist.",
                    },
                    {
                      title: "Reveal hints if you're stuck",
                      body: "Up to three hints per puzzle: primary type, generation, and the full extracted palette. Short cooldown between hints to keep the puzzle honest.",
                    },
                    {
                      title: "Solve in four attempts",
                      body: "Guess right inside four tries and the Pokémon goes into your Pokédex. Miss it and the answer is revealed — the streak resets but unlimited mode is right there for redemption.",
                    },
                  ].map((step, i) => (
                    <li key={i} className="flex gap-4">
                      <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold font-heading">
                        {i + 1}
                      </div>
                      <div className="pt-1">
                        <h3 className="font-semibold font-heading">
                          {step.title}
                        </h3>
                        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                          {step.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            {/* Features */}
            <section className="border-b bg-muted/10">
              <div className="container mx-auto px-4 md:px-6 py-16 max-w-5xl">
                <h2 className="text-2xl md:text-3xl font-bold font-heading mb-8 text-center">
                  Three game modes
                </h2>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {FEATURES.map((f) => (
                    <li
                      key={f.title}
                      className="rounded-xl border bg-card p-6"
                    >
                      <f.icon className="w-6 h-6 text-primary mb-3" aria-hidden="true" />
                      <h3 className="font-semibold font-heading text-lg">
                        {f.title}
                      </h3>
                      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                        {f.body}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* FAQ */}
            <section className="border-b">
              <div className="container mx-auto px-4 md:px-6 py-16 max-w-3xl">
                <h2 className="text-2xl md:text-3xl font-bold font-heading mb-8 text-center">
                  Frequently asked
                </h2>
                <dl className="space-y-6">
                  {FAQ.map((item) => (
                    <div key={item.q}>
                      <dt className="font-semibold font-heading">
                        {item.q}
                      </dt>
                      <dd className="mt-2 text-sm text-muted-foreground leading-relaxed">
                        {item.a}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>

            {/* Final CTA */}
            <section className="border-b">
              <div className="container mx-auto px-4 md:px-6 py-20 max-w-3xl text-center">
                <h2 className="text-3xl md:text-4xl font-bold font-heading">
                  Ready to play?
                </h2>
                <p className="mt-4 text-muted-foreground">
                  Today&apos;s puzzle is waiting. About two minutes, four
                  guesses, one Pokémon.
                </p>
                <div className="mt-8">
                  <Button
                    size="lg"
                    className="h-12 px-8 text-base font-semibold"
                    asChild
                  >
                    <Link
                      href="/game?utm_source=guess-the-pokemon&utm_medium=footer-cta&utm_campaign=landing"
                      prefetch
                    >
                      Start playing
                    </Link>
                  </Button>
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
