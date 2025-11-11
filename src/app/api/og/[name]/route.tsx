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

    // Generate OG image with Pokemon name and colors
    // Note: External images may not work reliably in Node.js runtime with @vercel/og
    // So we'll create a beautiful gradient with the Pokemon name instead
    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: `linear-gradient(80deg, ${color1} 0%, ${color1} 33.33%, ${color2} 33.33%, ${color2} 66.66%, ${color3} 66.66%, ${color3} 100%)`,
            position: "relative",
          }}
        >
          {/* Pokemon name in the center */}
          <div
            style={{
              fontSize: 80,
              fontWeight: "bold",
              color: "#ffffff",
              textShadow: "4px 4px 8px rgba(0,0,0,0.5)",
              textAlign: "center",
              marginBottom: 20,
            }}
          >
            {pokemon.name}
          </div>

          {/* Color swatches below the name */}
          <div
            style={{
              display: "flex",
              gap: 20,
              marginTop: 20,
            }}
          >
            {[color1, color2, color3].map((color, idx) => (
              <div
                key={idx}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  backgroundColor: color,
                  border: "4px solid rgba(255,255,255,0.3)",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
                }}
              />
            ))}
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
