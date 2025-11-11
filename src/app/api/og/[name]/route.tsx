import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";
import { getPokemonMetadataByName, getPokemonById } from "@/lib/pokemon";

// Use Node.js runtime instead of Edge to avoid bundle size limits
// Edge runtime has a 1MB limit, and importing Pokemon data exceeds this

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name: pokemonName } = await params;
    const pokemonMetadata = getPokemonMetadataByName(pokemonName);

    if (!pokemonMetadata) {
      return new Response("Pokemon not found", { status: 404 });
    }

    const pokemon = await getPokemonById(pokemonMetadata.id);

    if (!pokemon) {
      return new Response("Pokemon data not found", { status: 404 });
    }

    // Get the 3 main colors from the color palette
    const colors = pokemon.colorPalette?.highlights || [
      pokemon.colorPalette?.primary || "#94a3b8",
      pokemon.colorPalette?.secondary || "#94a3b8",
      pokemon.colorPalette?.accent || "#94a3b8",
    ];

    // Ensure we have at least 3 colors
    const color1 = colors[0] || "#94a3b8";
    const color2 = colors[1] || colors[0] || "#94a3b8";
    const color3 = colors[2] || colors[1] || colors[0] || "#94a3b8";

    // Get official artwork URL - use official artwork for better quality
    const artworkUrl = pokemon.artwork?.official || "";

    // If no artwork URL, return a simple colored image without Pokemon
    if (!artworkUrl) {
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
                fontSize: 60,
                fontWeight: "bold",
                color: "#ffffff",
                textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
              }}
            >
              {pokemon.name}
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
              alt={pokemon.name}
              width={600}
              height={600}
              style={{
                filter: "brightness(0)",
                opacity: 1,
              }}
            />
          </div>
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
  } catch (e: any) {
    console.error("Error generating OG image:", e);
    return new Response(`Failed to generate image: ${e.message}`, {
      status: 500,
    });
  }
}
