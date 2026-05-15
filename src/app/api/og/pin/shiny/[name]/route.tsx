import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";
import { getPokemonMetadataByName, getPokemonById } from "@/lib/pokemon";

export const runtime = "nodejs";

function toAbsoluteUrl(url: string, request: NextRequest): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : new URL(request.url).origin);
  return url.startsWith("/") ? `${origin}${url}` : `${origin}/${url}`;
}

async function getPokemonData(name: string) {
  try {
    const metadata = getPokemonMetadataByName(name);
    if (!metadata) return null;
    const pokemon = await getPokemonById(metadata.id);
    if (!pokemon) return null;
    return {
      id: pokemon.id,
      name: pokemon.name,
      colorPalette: pokemon.colorPalette,
      shinyColorPalette: pokemon.shinyColorPalette,
      artwork: pokemon.artwork,
    } as {
      id: number;
      name: string;
      colorPalette?: {
        primary?: string;
        secondary?: string;
        accent?: string;
        highlights?: string[];
      };
      shinyColorPalette?: {
        primary?: string;
        secondary?: string;
        accent?: string;
        highlights?: string[];
      };
      artwork?: {
        official?: string;
        front?: string;
        shiny?: string;
      };
    };
  } catch (error) {
    console.error(`Failed to load Pokemon data for ${name}:`, error);
    return null;
  }
}

const PIN_WIDTH = 1000;
const PIN_HEIGHT = 1500;

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const clean = hex.replace("#", "");
  if (clean.length < 6) return null;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 1;
  return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
}

// Pick a moody background tied to the palette. Prefers the darkest swatch and
// dims it further if it would not give white text enough contrast — that way
// the pin always looks confidently "dark and colorful", like the reference.
function pickBackground(swatches: string[]): string {
  let darkestHex = swatches[0] || "#1f2937";
  let darkestLum = 1;
  for (const hex of swatches) {
    const lum = luminance(hex);
    if (lum < darkestLum) {
      darkestLum = lum;
      darkestHex = hex;
    }
  }
  const rgb = parseHex(darkestHex);
  if (!rgb) return "#1f2937";
  const factor =
    darkestLum > 0.22 ? 0.18 / Math.max(darkestLum, 0.05) : 1;
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `rgb(${clamp(rgb.r * factor)}, ${clamp(rgb.g * factor)}, ${clamp(
    rgb.b * factor
  )})`;
}

function fallbackImage(text: string) {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(180deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)",
        }}
      >
        <div
          style={{ fontSize: 52, fontWeight: "bold", color: "#ffffff" }}
        >
          {text}
        </div>
      </div>
    ),
    {
      width: PIN_WIDTH,
      height: PIN_HEIGHT,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name: pokemonName } = await params;

    let pokemon;
    try {
      pokemon = await getPokemonData(pokemonName);
      if (!pokemon) return fallbackImage("Pokemon Not Found");
    } catch {
      return fallbackImage("PokémonPalette");
    }

    // Prefer the live page palette (passed via ?c=hex1,hex2,...) so the pin
    // reflects exactly what the user is seeing when they click "Pin It". The
    // static JSON palette is only the curated baseline (some shiny palettes
    // only have 3 colors) — we fall back to it when no override is provided.
    const overrideParam =
      new URL(request.url).searchParams.get("c") || "";
    const overrideColors = overrideParam
      .split(",")
      .map((c) => c.trim().replace(/^#/, "").toLowerCase())
      .filter((c) => /^[0-9a-f]{6}$/.test(c))
      .map((c) => `#${c}`)
      .slice(0, 6);

    const palette = pokemon.shinyColorPalette || pokemon.colorPalette;
    const highlights = palette?.highlights || [];
    const fallbacks = [
      palette?.primary,
      palette?.secondary,
      palette?.accent,
    ].filter((c): c is string => Boolean(c));
    const combined =
      overrideColors.length > 0
        ? overrideColors
        : [...highlights, ...fallbacks];
    const SWATCH_COUNT = 6;
    const swatches: string[] = Array.from({ length: SWATCH_COUNT }, (_, i) => {
      const direct = combined[i];
      if (direct) return direct;
      if (combined.length === 0) return "#94a3b8";
      return combined[i % combined.length] ?? "#94a3b8";
    });

    const bgColor = pickBackground(swatches);

    // Build the shiny artwork URL using the same logic as the shiny OG route.
    let artworkUrl = "";
    if (pokemon.artwork?.official) {
      const officialUrl = pokemon.artwork.official;
      if (
        officialUrl.startsWith("/pokemon/") &&
        !officialUrl.includes("/shiny/")
      ) {
        artworkUrl = officialUrl.replace("/pokemon/", "/pokemon/shiny/");
      } else if (officialUrl.includes("/other/official-artwork/")) {
        artworkUrl = officialUrl.replace(
          "/other/official-artwork/",
          "/other/official-artwork/shiny/"
        );
      } else {
        artworkUrl = officialUrl;
      }
    } else if (pokemon.artwork?.front) {
      artworkUrl = pokemon.artwork.front.replace(
        "/sprites/pokemon/",
        "/sprites/pokemon/shiny/"
      );
    }

    const absoluteArtworkUrl = toAbsoluteUrl(artworkUrl, request);

    const displayName =
      pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1);
    const dexNumber = `#${String(pokemon.id).padStart(3, "0")}`;

    const SWATCH_SIZE = 170;
    const SWATCH_OVERLAP = 28;

    try {
      return new ImageResponse(
        (
          <div
            style={{
              height: "100%",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              position: "relative",
              backgroundColor: bgColor,
            }}
          >
            {/* Header — pokedex number + name with shiny eyebrow */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                paddingTop: 80,
                zIndex: 2,
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: "#ffd234",
                  letterSpacing: "0.32em",
                  textTransform: "uppercase",
                }}
              >
                ✦ Shiny
              </div>
              <div
                style={{
                  fontSize: 40,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.7)",
                  letterSpacing: "0.18em",
                  marginTop: 12,
                }}
              >
                {dexNumber}
              </div>
              <div
                style={{
                  fontSize: 104,
                  fontWeight: 900,
                  color: "#ffffff",
                  marginTop: 4,
                  letterSpacing: "0.01em",
                  lineHeight: 1,
                  textTransform: "uppercase",
                }}
              >
                {displayName}
              </div>
            </div>

            {/* Shiny silhouette — large, faint, sitting behind the swatches */}
            {absoluteArtworkUrl && (
              <div
                style={{
                  position: "absolute",
                  top: 300,
                  left: 0,
                  right: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={absoluteArtworkUrl}
                  alt={`Shiny ${pokemon.name}`}
                  width={820}
                  height={820}
                  style={{
                    filter: "brightness(0)",
                    opacity: 0.22,
                  }}
                />
              </div>
            )}

            {/* Swatch + hex stack — centered over the silhouette */}
            <div
              style={{
                position: "absolute",
                top: 780,
                left: 0,
                right: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                zIndex: 3,
              }}
            >
              <div style={{ display: "flex", alignItems: "center" }}>
                {swatches.map((hex, i) => (
                  <div
                    key={i}
                    style={{
                      width: SWATCH_SIZE,
                      height: SWATCH_SIZE,
                      boxSizing: "border-box",
                      borderRadius: "50%",
                      backgroundColor: hex,
                      marginLeft: i === 0 ? 0 : -SWATCH_OVERLAP,
                      border: "8px solid #ffffff",
                      display: "flex",
                    }}
                  />
                ))}
              </div>

              <div style={{ display: "flex", marginTop: 28 }}>
                {swatches.map((hex, i) => (
                  <div
                    key={i}
                    style={{
                      width: SWATCH_SIZE,
                      display: "flex",
                      justifyContent: "center",
                      marginLeft: i === 0 ? 0 : -SWATCH_OVERLAP,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 800,
                        color: "#ffffff",
                        fontFamily: "monospace",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {hex.toUpperCase().startsWith("#")
                        ? hex.toUpperCase()
                        : `#${hex.toUpperCase()}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer branding */}
            <div
              style={{
                position: "absolute",
                bottom: 64,
                left: 0,
                right: 0,
                display: "flex",
                justifyContent: "center",
                zIndex: 2,
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  color: "#ffffff",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                }}
              >
                pokemonpalette.com
              </div>
            </div>
          </div>
        ),
        {
          width: PIN_WIDTH,
          height: PIN_HEIGHT,
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        }
      );
    } catch (imageError: unknown) {
      console.error("Shiny pin ImageResponse creation failed:", imageError);
      return fallbackImage(`Shiny ${displayName}`);
    }
  } catch (e: unknown) {
    console.error("Error generating shiny pin image:", e);
    return fallbackImage("PokémonPalette");
  }
}
