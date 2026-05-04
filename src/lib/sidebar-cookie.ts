// Shared cookie config for the collapsible sidebar. The state needs to be
// readable on the server (so layouts can render the correct width on first
// paint without a hydration flash) and writable on the client (so toggling
// persists across navigations and sessions). Cookies satisfy both, which is
// why this replaces the previous localStorage-only approach.

export const SIDEBAR_COOKIE_NAME = "sidebar_collapsed";
// 7 days is enough that returning users still see their preference, but
// short enough that abandoned preferences eventually clear out.
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/**
 * Parse the raw cookie value into a boolean. Defaults to `true` (collapsed)
 * when the cookie is missing — matches the previous default behavior.
 */
export function parseSidebarCookie(value: string | undefined): boolean {
  if (value === undefined) return true;
  return value === "true";
}
