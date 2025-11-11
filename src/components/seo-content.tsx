/**
 * SEO Content Component
 * Renders SEO-friendly content that's visible to search engines
 * but can be hidden from users if needed
 */

interface SEOContentProps {
  type: "home" | "pokemon";
  pokemonName?: string;
  pokemonType?: string[];
  pokemonGeneration?: number;
}

export function SEOContent({ type, pokemonName, pokemonType, pokemonGeneration }: SEOContentProps) {
  if (type === "home") {
    return (
      <div className="sr-only" aria-hidden="true">
        <h1>Pokémon Color Palette Generator</h1>
        <p>
          Extract beautiful color palettes from your favorite Pokémon sprites. 
          Our free design tool allows you to generate custom color schemes from over 1000+ Pokémon, 
          including shiny variants. Perfect for designers, artists, and Pokémon fans looking for 
          color inspiration for web design, graphic design, and digital art projects.
        </p>
        <h2>Features</h2>
        <ul>
          <li>Extract dominant colors from Pokémon sprites</li>
          <li>Browse all 1000+ Pokémon with official artwork</li>
          <li>Generate custom color palettes in HEX, RGB, and HSL formats</li>
          <li>Save and manage your favorite color schemes</li>
          <li>Play daily color guessing games</li>
          <li>Explore random Pokémon color palettes</li>
        </ul>
        <h2>How to Use</h2>
        <p>
          Simply search for any Pokémon by name or Pokédex number. Our tool will automatically 
          extract the top 3 dominant colors from the official artwork. You can toggle between 
          normal and shiny variants, save your favorite palettes, and use the colors in your 
          design projects.
        </p>
      </div>
    );
  }

  if (type === "pokemon" && pokemonName) {
    const typeText = pokemonType?.join(" and ") || "Pokémon";
    const genText = pokemonGeneration ? ` from Generation ${pokemonGeneration}` : "";
    
    return (
      <div className="sr-only" aria-hidden="true">
        <h1>{pokemonName} Color Palette</h1>
        <p>
          Explore {pokemonName}&apos;s color palette extracted from official artwork. 
          {pokemonName} is a {typeText}-type Pokémon{genText}. 
          Use these colors in your design projects, web development, or digital art.
        </p>
        <h2>About {pokemonName}</h2>
        <p>
          Extract the dominant colors from {pokemonName}&apos;s sprite to create beautiful 
          color schemes. Our color palette generator automatically identifies the top colors 
          used in {pokemonName}&apos;s official artwork, making it easy to incorporate these 
          colors into your creative projects.
        </p>
      </div>
    );
  }

  return null;
}

