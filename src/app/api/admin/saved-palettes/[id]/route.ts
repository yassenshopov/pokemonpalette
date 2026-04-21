import { NextRequest, NextResponse } from "next/server";
import { Prisma, prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/auth";
import { logger } from "@/lib/logger";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await params;

  try {
    const palette = await prisma.savedPalette.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
            profileImageUrl: true,
          },
        },
      },
    });

    if (!palette) {
      return NextResponse.json({ error: "Palette not found" }, { status: 404 });
    }

    const related = await prisma.savedPalette.findMany({
      where: { pokemonId: palette.pokemonId, id: { not: palette.id } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        userId: true,
        pokemonId: true,
        pokemonName: true,
        isShiny: true,
        colors: true,
        imageUrl: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      palette: {
        id: palette.id,
        user_id: palette.userId,
        pokemon_id: palette.pokemonId,
        pokemon_name: palette.pokemonName,
        pokemon_form: palette.pokemonForm,
        is_shiny: palette.isShiny,
        colors: palette.colors,
        image_url: palette.imageUrl,
        palette_name: palette.paletteName,
        created_at: palette.createdAt.toISOString(),
        updated_at: palette.updatedAt.toISOString(),
      },
      user: palette.user
        ? {
            id: palette.user.id,
            email: palette.user.email,
            username: palette.user.username,
            first_name: palette.user.firstName,
            last_name: palette.user.lastName,
            image_url: palette.user.imageUrl,
            profile_image_url: palette.user.profileImageUrl,
          }
        : null,
      related: related.map((r) => ({
        id: r.id,
        user_id: r.userId,
        pokemon_id: r.pokemonId,
        pokemon_name: r.pokemonName,
        is_shiny: r.isShiny,
        colors: r.colors,
        image_url: r.imageUrl,
        created_at: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError ||
      err instanceof Prisma.PrismaClientValidationError
    ) {
      return NextResponse.json({ error: "Palette not found" }, { status: 404 });
    }
    logger.error("admin.saved-palettes.get_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await params;

  try {
    const result = await prisma.savedPalette.deleteMany({ where: { id } });
    if (result.count === 0) {
      return NextResponse.json({ error: "Palette not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError ||
      err instanceof Prisma.PrismaClientValidationError
    ) {
      return NextResponse.json({ error: "Palette not found" }, { status: 404 });
    }
    logger.error("admin.saved-palettes.delete_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to delete palette" },
      { status: 500 },
    );
  }
}
