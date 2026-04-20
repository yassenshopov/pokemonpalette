import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt =
  "PokemonPalette - Extract color palettes from Pokemon sprites";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Pokemon-ish hero palette (Charizard-adjacent) - recognizable + on-brand.
const SWATCHES = ["#E8843B", "#F4C842", "#B84A2E", "#2A2A2A", "#F5F1EA"];

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0F0F10",
          padding: 72,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            flex: 1,
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 28,
              letterSpacing: 4,
              color: "#9CA3AF",
              textTransform: "uppercase",
            }}
          >
            pokemonpalette.com
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 96,
              fontWeight: 800,
              color: "#FFFFFF",
              lineHeight: 1.02,
              letterSpacing: -2,
            }}
          >
            Extract color palettes
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 96,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: -2,
              background:
                "linear-gradient(90deg, #E8843B 0%, #F4C842 50%, #B84A2E 100%)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            from every Pokemon.
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 32,
              color: "#D1D5DB",
              marginTop: 18,
              maxWidth: 900,
            }}
          >
            1,000+ Pokemon. Shiny variants. A daily color-guessing game.
          </div>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {SWATCHES.map((hex) => (
            <div
              key={hex}
              style={{
                display: "flex",
                flex: 1,
                height: 96,
                borderRadius: 16,
                background: hex,
              }}
            />
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
