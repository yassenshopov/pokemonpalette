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

    const palette = pokemon.shinyColorPalette || pokemon.colorPalette;
    const highlights = palette?.highlights || [];
    const swatches = [
      highlights[0] || palette?.primary || "#94a3b8",
      highlights[1] || palette?.secondary || "#94a3b8",
      highlights[2] || palette?.accent || "#94a3b8",
      highlights[3] || highlights[0] || "#94a3b8",
      highlights[4] || highlights[1] || "#94a3b8",
    ];

    const bgTop = swatches[0];
    const bgBottom = swatches[2];

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
              background: `linear-gradient(180deg, ${bgTop}30 0%, ${bgBottom}20 100%)`,
              backgroundColor: "#ffffff",
            }}
          >
            {/* Sprite area — top 55% */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "55%",
                width: "100%",
                position: "relative",
              }}
            >
              {absoluteArtworkUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={absoluteArtworkUrl}
                  alt={`Shiny ${pokemon.name}`}
                  width={560}
                  height={560}
                  style={{ filter: "brightness(0)", opacity: 0.85 }}
                />
              )}
            </div>

            {/* Name + "shiny color palette" label */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "0 40px",
              }}
            >
              <div
                style={{
                  fontSize: 56,
                  fontWeight: 800,
                  color: "#18181b",
                  lineHeight: 1.1,
                }}
              >
                {displayName}
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 500,
                  color: "#71717a",
                  marginTop: 8,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Shiny Color Palette
              </div>
            </div>

            {/* Swatch row */}
            <div
              style={{
                display: "flex",
                gap: 16,
                padding: "32px 40px 0 40px",
                justifyContent: "center",
              }}
            >
              {swatches.map((hex, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 140,
                      height: 140,
                      borderRadius: 20,
                      backgroundColor: hex,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                  />
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      color: "#52525b",
                      fontFamily: "monospace",
                    }}
                  >
                    {hex.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer branding */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                marginTop: "auto",
                paddingBottom: 32,
              }}
            >
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  color: "#a1a1aa",
                  letterSpacing: "0.04em",
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
