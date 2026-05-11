# PokémonPalette

Extract color palettes from every Pokémon sprite — and play a daily Pokémon-guessing game built around them.

Live at **[pokemonpalette.com](https://www.pokemonpalette.com)**.

## Features

- **Palette extraction** — dominant colors for every Pokémon (1000+), including shiny variants
- **Daily game** — Wordle-style guessing game using palette similarity as the hint signal
- **Unlimited mode** — same game, no daily limit, configurable palette size
- **Multiplayer** — host or join a room and race a friend on the same Pokémon
- **Pokédex** — track which Pokémon you've caught across modes
- **Saved palettes** — bookmark and export your favorites
- **Public API** — paid `/api/v1/palettes` endpoint (Stripe-gated, API-key auth)
- **Admin panel** — users, palettes, daily overrides, email campaigns, geo insights
- **Accessibility** — colorblind modes, keyboard shortcuts, skip links, WCAG-compliant viewport

## Tech stack


| Layer      | Tools                                                             |
| ---------- | ----------------------------------------------------------------- |
| Framework  | Next.js 15 (App Router, Turbopack), React 19, TypeScript          |
| UI         | Tailwind CSS 4, shadcn/ui (Radix), Lucide, Sonner, GSAP, Recharts |
| Auth       | Clerk                                                             |
| Database   | Supabase (Postgres) + Prisma ORM (introspection-only)             |
| Email      | Resend                                                            |
| Payments   | Stripe (Checkout + webhooks)                                      |
| Rate limit | Upstash Redis                                                     |
| Analytics  | GA4, Google AdSense                                               |


Schema lives in `supabase/migrations/` (source of truth, includes RLS + RPCs). Prisma is used only for typed queries — never for migrations.

## Getting started

### Prerequisites

- Node.js 18+
- A Supabase project (database + auth)
- A Clerk app (auth) — optional in dev; the app no-ops auth when keys are absent

### Setup

```bash
git clone https://github.com/yassenshopov/pokemonpalette.git
cd pokemonpalette
npm install
```

Create `.env.local` with the variables below (only Clerk + Supabase are required for core functionality):

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# Supabase / Postgres
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=        # pgbouncer pooler, port 6543
DIRECT_URL=          # direct connection, port 5432 (prisma migrate only)

# Optional
RESEND_API_KEY=
RESEND_FROM_EMAIL=
NEXT_PUBLIC_BASE_URL=http://localhost:212
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PALETTE_API_PRICE_ID=
NEXT_PUBLIC_GA4_ID=
NEXT_PUBLIC_ADSENSE_CLIENT_ID=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Run the dev server:

```bash
npm run dev          # http://localhost:212
```

For local webhook testing (Clerk, Stripe) over ngrok:

```bash
npm run dev:ngrok
npm run webhook:info     # print current tunnel URL + Clerk/Stripe endpoints
```

## Scripts


| Command             | Purpose                                       |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Dev server on port 212 (Turbopack)            |
| `npm run dev:ngrok` | Dev server + ngrok tunnel for webhook testing |
| `npm run build`     | `prisma generate` + production build          |
| `npm start`         | Run production build                          |
| `npm run lint`      | ESLint                                        |
| `npm run db:studio` | Open Prisma Studio                            |
| `npm run db:pull`   | Re-introspect Postgres into `schema.prisma`   |
| `npm run db:format` | Format `schema.prisma`                        |
| `npm run test:seo`  | Run SEO smoke checks against the live site    |
| `npm run webhook:*` | Inspect / test ngrok webhook URLs             |


## Project layout

```
src/
  app/                 # Next.js App Router
    api/               # Route handlers (admin, billing, multiplayer, v1 public API, webhooks…)
    [name]/            # Pokémon detail page
    shiny/[name]/      # Shiny variant detail page
    type/[type]/       # Browse by type
    rarity/[rarity]/   # Browse by rarity
    generation/[gen]/  # Browse by generation
    game/              # Daily + unlimited guessing game (+ Pokédex)
    explore/           # Public palette feed
    saved-palettes/    # User's saved palettes
    account/           # Account settings, API keys
    admin/             # Admin: users, palettes, game data, emails, insights
    api-access/        # Stripe checkout for API access
  components/          # Feature + UI components (shadcn/ui in components/ui)
  lib/                 # Shared utilities, Prisma client, palette algorithms
prisma/
  schema.prisma        # Introspected from Supabase — DO NOT migrate from here
supabase/
  migrations/          # Source of truth: tables, RLS policies, SECURITY DEFINER RPCs
public/
  pokemon/             # Pre-extracted sprite PNGs (immutably cached)
  data/                # Pre-built per-Pokémon JSON (immutably cached)
scripts/               # ngrok dev helper, webhook test utilities
```

## Database notes

- **Migrations** are raw SQL in `supabase/migrations/` (they encode RLS + RPCs Prisma can't express).
- **Prisma** is introspection-only — `db:pull` regenerates `schema.prisma` from the live DB.
- The runtime `DATABASE_URL` must use the **pgbouncer pooler (port 6543, transaction mode)** to avoid connection exhaustion on serverless. `DIRECT_URL` (port 5432) is only used by `prisma migrate`/`db pull`.

## Deployment

Deployed on **Vercel**. The build command runs `prisma generate` before `next build`. Configure all environment variables in the Vercel project settings; Clerk and Stripe webhooks point at `https://www.pokemonpalette.com/api/webhooks/clerk` and `/api/billing/webhook` respectively.

## License

MIT © Yassen Shopov. See `[LICENSE](LICENSE)`.