/**
 * Pokemon-related constants
 */

// Default Pokemon to show on first load
export const DEFAULT_POKEMON_ID = 60; // Poliwag

// You can change this to any Pokemon ID you prefer:
// 1 = Bulbasaur
// 4 = Charmander  
// 7 = Squirtle
// 25 = Pikachu
// 60 = Poliwag
// 150 = Mewtwo
// 151 = Mew
// etc.

// Other Pokemon constants can be added here as needed
export const POKEMON_CONSTANTS = {
  DEFAULT_ID: DEFAULT_POKEMON_ID,
  MAX_BASE_STAT: 255,
  COLORS_TO_EXTRACT: 6,
  PALETTE_COLORS_COUNT: 3,
} as const;
