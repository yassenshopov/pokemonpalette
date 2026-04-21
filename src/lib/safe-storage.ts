/**
 * SSR-safe localStorage wrapper.
 *
 * - Returns null during SSR (no window).
 * - Never throws on QuotaExceededError / corrupt JSON / disabled storage.
 * - Logs in dev so issues are visible without crashing the UI.
 *
 * Prefer these over direct `localStorage.getItem` + `JSON.parse`. A single
 * bad localStorage blob (user installed another app that clobbered a key,
 * corrupted extension, etc.) should NOT crash the app.
 */

const isBrowser = typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export function safeGetItem(key: string): string | null {
  if (!isBrowser) return null;
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`safeGetItem(${key}) failed:`, err);
    }
    return null;
  }
}

export function safeSetItem(key: string, value: string): boolean {
  if (!isBrowser) return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`safeSetItem(${key}) failed:`, err);
    }
    return false;
  }
}

export function safeRemoveItem(key: string): void {
  if (!isBrowser) return;
  try {
    window.localStorage.removeItem(key);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`safeRemoveItem(${key}) failed:`, err);
    }
  }
}

/**
 * Parse JSON from localStorage with a schema fallback. Always returns a
 * value of type T — either the parsed value or `fallback`.
 */
export function safeGetJSON<T>(key: string, fallback: T): T {
  const raw = safeGetItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`safeGetJSON(${key}) failed, using fallback:`, err);
    }
    return fallback;
  }
}

export function safeSetJSON(key: string, value: unknown): boolean {
  try {
    return safeSetItem(key, JSON.stringify(value));
  } catch {
    return false;
  }
}
