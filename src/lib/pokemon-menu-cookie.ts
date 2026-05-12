/**
 * Shared cookie config for the homepage / shiny-page Pokémon menu's
 * collapsed state.
 *
 * Mirrors `sidebar-cookie.ts` and exists for the same reason: the
 * value has to be readable on the server (so the page paints in the
 * correct collapsed/expanded state on first render) and writable on
 * the client (so toggling persists). Reading from `localStorage` in a
 * `useEffect` was responsible for a visible hydration flash on slow
 * connections — every visit to / or /shiny/[name] first rendered with
 * the menu expanded, then snapped to whatever the user had last
 * persisted.
 */

export const POKEMON_MENU_COOKIE_NAME = "pokemon_menu_collapsed";
// One month — long enough to survive everyday browsing rhythms without
// pinning the preference forever. Matches the visual "this is sticky
// across normal usage" expectation users have for layout toggles.
export const POKEMON_MENU_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Parse the raw cookie value into a boolean. Defaults to `false`
 * (expanded) when the cookie is missing — matches the visual baseline
 * everyone expects on first visit.
 */
export function parsePokemonMenuCookie(value: string | undefined): boolean {
  if (value === undefined) return false;
  return value === "true";
}

/**
 * Write the cookie from the client. Safe to call from any
 * `useEffect`; no-ops on the server.
 */
export function writePokemonMenuCookie(value: boolean): void {
  if (typeof document === "undefined") return;
  document.cookie = `${POKEMON_MENU_COOKIE_NAME}=${value}; path=/; max-age=${POKEMON_MENU_COOKIE_MAX_AGE}; SameSite=Lax`;
}
