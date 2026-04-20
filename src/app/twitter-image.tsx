// Twitter card image for https://www.pokemonpalette.com/.
// Visually identical to the OG image, but declared as its own module because
// Next.js statically analyzes these files and requires literal exports for
// `runtime`, `size`, `alt`, `contentType` - re-exports are silently ignored.
export { default } from "./opengraph-image";

export const runtime = "nodejs";
export const alt =
  "PokemonPalette - Extract color palettes from Pokemon sprites";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
