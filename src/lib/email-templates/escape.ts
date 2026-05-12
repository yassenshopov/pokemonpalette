/**
 * Shared HTML / URL escape helpers for outgoing email templates.
 *
 * All values interpolated into the hand-rolled HTML strings in this
 * folder MUST go through one of these helpers. The templates use
 * tagged-template-literal concatenation (not a vetted renderer like
 * React or MJML), so an unescaped `${user.firstName}` is a direct
 * stored-XSS vector — most relevant when an admin previews / sends a
 * crafted payload, but also relevant for `userName` derived from
 * Clerk first/last name fields the user controls.
 */

/** Escape characters with HTML special meaning. Suitable for text
 *  nodes and `"`-quoted attribute values. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sanitise a value that will be placed inside an `href="…"`.
 *
 * Rejects any URL whose scheme isn't on the allowlist — this is the
 * single most important defense against `javascript:` and `data:`
 * URI injection into anchor tags from admin-controlled inputs. The
 * scheme check is applied to the trimmed, lowercased start of the
 * string so leading whitespace / mixed case can't bypass it.
 *
 * Returns the escaped URL if it passes, or `#` as a safe inert
 * fallback if it fails. We intentionally do NOT throw — failing
 * silently is preferable to crashing a scheduled email send for one
 * bad recipient row.
 */
export function escapeUrl(value: string, fallback = "#"): string {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  // Allowlist: https only externally, plus relative paths (which start
  // with `/` or `./` or `../`). Mailto / tel are not needed by our
  // templates today; add explicitly if a template ever needs them.
  const isAllowed =
    lower.startsWith("https://") ||
    lower.startsWith("/") ||
    lower.startsWith("./") ||
    lower.startsWith("../");
  if (!isAllowed) return fallback;
  return escapeHtml(trimmed);
}
