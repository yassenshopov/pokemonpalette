/**
 * Utility functions for getting Pokemon sprite URLs with local image priority
 */

/**
 * Get sprite URL with local image priority
 * Checks for local images first, then falls back to provided URL
 * 
 * @param pokemonId - Pokemon ID
 * @param spriteType - Type of sprite: 'front' | 'back' | 'shiny' | 'back_shiny' | 'official'
 * @param fallbackUrl - Fallback URL if local image doesn't exist
 * @param isShiny - Whether to get shiny version (for official artwork)
 * @returns Local path if exists, otherwise fallback URL
 */
export function getSpriteUrlWithLocalPriority(
  pokemonId: number,
  spriteType: 'front' | 'back' | 'shiny' | 'back_shiny' | 'official',
  fallbackUrl: string | null,
  isShiny: boolean = false
): string | null {
  // For official artwork, handle shiny transformation
  if (spriteType === 'official') {
    const regularPath = `/pokemon/${pokemonId}.png`;
    const shinyPath = `/pokemon/shiny/${pokemonId}.png`;
    
    // In Next.js, we can't check if file exists at build time
    // So we'll return the local path and let the browser handle 404s
    // The Image component will fallback to the fallbackUrl on error
    return isShiny ? shinyPath : regularPath;
  }
  
  // For sprites, construct local path
  const spritePaths: Record<string, string> = {
    front: `/pokemon/sprites/${pokemonId}.png`,
    back: `/pokemon/sprites/back/${pokemonId}.png`,
    shiny: `/pokemon/sprites/shiny/${pokemonId}.png`,
    back_shiny: `/pokemon/sprites/back/shiny/${pokemonId}.png`,
  };
  
  const localPath = spritePaths[spriteType];
  if (localPath) {
    return localPath;
  }
  
  return fallbackUrl;
}

/**
 * Get front sprite URL with local priority
 */
export function getFrontSpriteUrl(
  pokemonId: number,
  isShiny: boolean,
  fallbackUrl: string | null
): string | null {
  return getSpriteUrlWithLocalPriority(
    pokemonId,
    isShiny ? 'shiny' : 'front',
    fallbackUrl,
    isShiny
  );
}

/**
 * Get official artwork URL with local priority
 */
export function getOfficialArtworkUrl(
  pokemonId: number,
  isShiny: boolean,
  fallbackUrl: string | null
): string | null {
  return getSpriteUrlWithLocalPriority(
    pokemonId,
    'official',
    fallbackUrl,
    isShiny
  );
}

/**
 * Get sprite URL from Pokemon artwork object with local priority
 * Checks local paths first, then uses artwork fields
 */
export function getSpriteFromArtwork(
  pokemonId: number,
  artwork: { front?: string | null; shiny?: string | null; back?: string | null; back_shiny?: string | null; official?: string | null },
  isShiny: boolean,
  type: 'front' | 'back' | 'official' = 'front'
): string | null {
  if (type === 'official') {
    const officialUrl = artwork.official;
    if (!officialUrl) return null;
    
    // If already local, handle shiny transformation
    if (officialUrl.startsWith('/pokemon/')) {
      if (isShiny && !officialUrl.includes('/shiny/')) {
        return officialUrl.replace('/pokemon/', '/pokemon/shiny/');
      }
      return officialUrl;
    }
    
    // If URL, check for local first
    const localPath = isShiny 
      ? `/pokemon/shiny/${pokemonId}.png`
      : `/pokemon/${pokemonId}.png`;
    
    // Return local path (browser will handle 404 fallback)
    return localPath;
  }
  
  if (type === 'front') {
    if (isShiny && artwork.shiny) {
      // Check if it's already local
      if (artwork.shiny.startsWith('/pokemon/')) {
        return artwork.shiny;
      }
      // Return local path first
      return `/pokemon/sprites/shiny/${pokemonId}.png`;
    }
    
    if (artwork.front) {
      // Check if it's already local
      if (artwork.front.startsWith('/pokemon/')) {
        return artwork.front;
      }
      // Return local path first
      return `/pokemon/sprites/${pokemonId}.png`;
    }
  }
  
  if (type === 'back') {
    if (isShiny && artwork.back_shiny) {
      if (artwork.back_shiny.startsWith('/pokemon/')) {
        return artwork.back_shiny;
      }
      return `/pokemon/sprites/back/shiny/${pokemonId}.png`;
    }
    
    if (artwork.back) {
      if (artwork.back.startsWith('/pokemon/')) {
        return artwork.back;
      }
      return `/pokemon/sprites/back/${pokemonId}.png`;
    }
  }
  
  return null;
}
