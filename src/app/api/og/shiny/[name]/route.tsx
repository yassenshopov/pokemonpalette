import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

// Use Edge runtime - required for @vercel/og to work
export const runtime = "edge";

// Fetch Pokemon data from internal API to avoid bundling large files
async function getPokemonData(name: string, request: NextRequest) {
  try {
    // Use the request URL to determine the base URL for internal API calls
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    // Fetch Pokemon data from an internal API route
    // This avoids bundling the full Pokemon library
    const response = await fetch(
      `${baseUrl}/api/pokemon-data/${name.toLowerCase()}`,
      {
        headers: {
          "User-Agent": "OG-Image-Generator",
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as {
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
    console.error(`Failed to fetch Pokemon data for ${name}:`, error);
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name: pokemonName } = await params;

    let pokemon;

    try {
      pokemon = await getPokemonData(pokemonName, request);
      if (!pokemon) {
        // Return a fallback image instead of 404 text
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
                  "linear-gradient(80deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)",
              }}
            >
              <div
                style={{
                  fontSize: 60,
                  fontWeight: "bold",
                  color: "#ffffff",
                }}
              >
                Pokemon Not Found
              </div>
            </div>
          ),
          {
            width: 1200,
            height: 675,
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": "public, max-age=3600",
            },
          }
        );
      }
    } catch (error) {
      console.error("Error loading Pokemon data:", error);
      // Return a fallback image instead of 500 text
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
                "linear-gradient(80deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)",
            }}
          >
            <div
              style={{
                fontSize: 60,
                fontWeight: "bold",
                color: "#ffffff",
              }}
            >
              PokémonPalette
            </div>
          </div>
        ),
        {
          width: 1200,
          height: 675,
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=3600",
          },
        }
      );
    }

    // Get the 3 main colors from the shiny color palette (fallback to normal if not available)
    const colorPalette = pokemon.shinyColorPalette || pokemon.colorPalette;
    const colors = colorPalette?.highlights || [
      colorPalette?.primary || "#94a3b8",
      colorPalette?.secondary || "#94a3b8",
      colorPalette?.accent || "#94a3b8",
    ];

    // Ensure we have at least 3 colors
    const color1 = colors[0] || "#94a3b8";
    const color2 = colors[1] || colors[0] || "#94a3b8";
    const color3 = colors[2] || colors[1] || colors[0] || "#94a3b8";

    // Get shiny official artwork URL
    // Construct by replacing "/other/official-artwork/" with "/other/official-artwork/shiny/"
    let artworkUrl = "";
    if (pokemon.artwork?.official) {
      const officialUrl = pokemon.artwork.official;
      // Handle both PokeAPI URLs and local paths
      if (officialUrl.startsWith("/pokemon/") && !officialUrl.includes("/shiny/")) {
        // Local path: /pokemon/10282.png -> /pokemon/shiny/10282.png
        artworkUrl = officialUrl.replace("/pokemon/", "/pokemon/shiny/");
      } else if (officialUrl.includes("/other/official-artwork/")) {
        // PokeAPI URL: replace the path segment
        artworkUrl = officialUrl.replace(
          "/other/official-artwork/",
          "/other/official-artwork/shiny/"
        );
      } else {
        artworkUrl = officialUrl;
      }
    } else if (pokemon.artwork?.front) {
      // Fallback: construct from front sprite if official not available
      artworkUrl = pokemon.artwork.front.replace(
        "/sprites/pokemon/",
        "/sprites/pokemon/shiny/"
      );
    }

    try {
      return new ImageResponse(
        (
          <div
            style={{
              height: "100%",
              width: "100%",
              display: "flex",
              position: "relative",
              background: `linear-gradient(80deg, ${color1} 0%, ${color1} 33.33%, ${color2} 33.33%, ${color2} 66.66%, ${color3} 66.66%, ${color3} 100%)`,
            }}
          >
            {/* Pokemon silhouette in the center - absolute positioned overlay */}
            {artworkUrl && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src={artworkUrl}
                  alt={`Shiny ${pokemon.name}`}
                  width={600}
                  height={600}
                  style={{
                    filter: "brightness(0)",
                    opacity: 1,
                  }}
                />
              </div>
            )}
          </div>
        ),
        {
          width: 1200,
          height: 675, // 16:9 aspect ratio
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        }
      );
    } catch (imageError: any) {
      console.error("ImageResponse creation failed:", imageError);
      console.error("ImageResponse error message:", imageError.message);
      console.error("ImageResponse error stack:", imageError.stack);
      console.error("Pokemon:", {
        id: pokemon.id,
        name: pokemon.name,
        artworkUrl,
      });

      // Fallback: return image without Pokemon artwork if ImageResponse fails
      return new ImageResponse(
        (
          <div
            style={{
              height: "100%",
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `linear-gradient(80deg, ${color1} 0%, ${color1} 33.33%, ${color2} 33.33%, ${color2} 66.66%, ${color3} 66.66%, ${color3} 100%)`,
            }}
          >
            <div
              style={{
                fontSize: 80,
                fontWeight: "bold",
                color: "#ffffff",
                textShadow: "4px 4px 8px rgba(0,0,0,0.5)",
              }}
            >
              Shiny {pokemon.name}
            </div>
          </div>
        ),
        {
          width: 1200,
          height: 675,
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        }
      );
    }
  } catch (e: any) {
    console.error("Error generating OG image:", e);
    console.error("Error stack:", e.stack);
    console.error("Error message:", e.message);
    // Return a fallback image instead of error
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
              "linear-gradient(80deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)",
          }}
        >
          <div
            style={{
              fontSize: 60,
              fontWeight: "bold",
              color: "#ffffff",
            }}
          >
            PokémonPalette
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 675,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=3600",
        },
      }
    );
  }
}
