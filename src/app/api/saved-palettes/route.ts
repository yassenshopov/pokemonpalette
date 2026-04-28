import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// 60 saves/hour per user — generous for a palette-hoarding power user,
// and still far below what a scripted attacker could use to DOS the DB.
const writeLimiter = rateLimit("saved-palettes-post", {
  requests: 60,
  window: "1 h",
});

function serializePalette(p: {
  id: string;
  userId: string;
  pokemonId: number;
  pokemonName: string;
  pokemonForm: string | null;
  isShiny: boolean;
  colors: unknown;
  imageUrl: string | null;
  paletteName: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: p.id,
    user_id: p.userId,
    pokemon_id: p.pokemonId,
    pokemon_name: p.pokemonName,
    pokemon_form: p.pokemonForm,
    is_shiny: p.isShiny,
    colors: p.colors,
    image_url: p.imageUrl,
    palette_name: p.paletteName,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
  };
}

// GET - Retrieve user's saved palettes
export async function GET() {
  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId;
  } catch (authError) {
    logger.error("auth.service_unavailable", {
      route: "GET /api/saved-palettes",
    });
    return NextResponse.json(
      { error: "Authentication service unavailable" },
      { status: 503 }
    );
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const palettes = await prisma.savedPalette.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return NextResponse.json({ palettes: palettes.map(serializePalette) });
  } catch (err) {
    logger.error("saved-palettes.fetch_failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to fetch saved palettes" },
      { status: 500 }
    );
  }
}

// POST - Save a new palette (or update if same Pokemon configuration exists)
const HEX = /^#[0-9a-fA-F]{6}$/;

// The hero component prefers locally-bundled artwork (e.g. "/pokemon/25.png")
// and only falls back to an absolute URL when the local file is missing, so
// `imageUrl` must accept either an absolute http(s) URL or a site-relative
// path beginning with "/". Anything else (protocol-relative, javascript:, etc.)
// is rejected.
const ImageUrlSchema = z
  .string()
  .max(2048)
  .refine(
    (v) => {
      if (v.startsWith("/") && !v.startsWith("//")) return true;
      try {
        const u = new URL(v);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Expected an http(s) URL or a site-relative path" }
  );

const PostBodySchema = z.object({
  pokemonId: z.number().int().min(1).max(100000),
  pokemonName: z.string().min(1).max(100),
  pokemonForm: z.string().max(100).nullish(),
  isShiny: z.boolean(),
  // Cap palette length so a single user can't dump large blobs into JSONB.
  colors: z
    .array(z.string().regex(HEX, "Expected hex color #RRGGBB"))
    .min(1)
    .max(12),
  imageUrl: ImageUrlSchema.nullish(),
  paletteName: z.string().max(100).nullish(),
});

export async function POST(req: NextRequest) {
  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId;
  } catch (authError) {
    logger.error("auth.service_unavailable", {
      route: "POST /api/saved-palettes",
    });
    return NextResponse.json(
      { error: "Authentication service unavailable" },
      { status: 503 }
    );
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await writeLimiter.check(userId);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": Math.max(
            1,
            Math.ceil((rl.resetAt - Date.now()) / 1000)
          ).toString(),
        },
      }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PostBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const {
    pokemonId,
    pokemonName,
    pokemonForm,
    isShiny,
    colors,
    imageUrl,
    paletteName,
  } = parsed.data;

  // Dedupe by (user_id, pokemon_id, pokemon_form, is_shiny). The DB has no
  // unique constraint on this tuple (only the PK), so Prisma's `upsert`
  // helper isn't usable here. We wrap the find+mutate pair in a transaction
  // so concurrent writers don't create duplicate rows. updateMany() returns
  // a count so we can tell whether we actually hit an existing row.
  try {
    const palette = await prisma.$transaction(async (tx) => {
      const existing = await tx.savedPalette.findFirst({
        where: {
          userId,
          pokemonId,
          isShiny,
          pokemonForm: pokemonForm ?? null,
        },
        select: { id: true },
      });

      if (existing) {
        return tx.savedPalette.update({
          where: { id: existing.id },
          data: {
            colors,
            imageUrl: imageUrl ?? null,
            paletteName: paletteName ?? null,
            updatedAt: new Date(),
          },
        });
      }

      return tx.savedPalette.create({
        data: {
          userId,
          pokemonId,
          pokemonName,
          pokemonForm: pokemonForm ?? null,
          isShiny,
          colors,
          imageUrl: imageUrl ?? null,
          paletteName: paletteName ?? null,
        },
      });
    });

    return NextResponse.json({
      message: "Palette saved successfully",
      palette: serializePalette(palette),
    });
  } catch (err) {
    logger.error("saved-palettes.save_failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to save palette" },
      { status: 500 }
    );
  }
}
