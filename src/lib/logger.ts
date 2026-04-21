/**
 * Minimal structured logger.
 *
 * Rationale: the app was scattered with `console.log("🔔 ...", payload)`
 * calls that dumped PII (emails, external provider ids, metadata blobs)
 * into Vercel's log stream. That violated data-handling norms and made
 * real errors hard to spot in prod.
 *
 * This logger:
 *   - Writes JSON-shaped messages so Vercel's log viewer can filter on
 *     `level`, `event`, etc.
 *   - Suppresses `debug` / `info` in production unless LOG_LEVEL overrides.
 *   - Never logs an entire object as a positional argument — only the
 *     `context` field, which callers are expected to scrub.
 *
 * For new code, prefer: `logger.info("user.synced", { userId })`.
 */

type Level = "debug" | "info" | "warn" | "error";

const levelOrder: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function minLevel(): number {
  const env = (process.env.LOG_LEVEL ?? "").toLowerCase() as Level | "";
  if (env && env in levelOrder) return levelOrder[env as Level];
  return process.env.NODE_ENV === "production"
    ? levelOrder.info
    : levelOrder.debug;
}

function emit(level: Level, event: string, context?: Record<string, unknown>) {
  if (levelOrder[level] < minLevel()) return;
  const entry = {
    level,
    event,
    ...(context ?? {}),
    time: new Date().toISOString(),
  };
  const fn =
    level === "error"
      ? console.error
      : level === "warn"
      ? console.warn
      : console.log;
  // Single-arg to keep a single JSON line in Vercel's log pipeline.
  fn(JSON.stringify(entry));
}

export const logger = {
  debug: (event: string, context?: Record<string, unknown>) =>
    emit("debug", event, context),
  info: (event: string, context?: Record<string, unknown>) =>
    emit("info", event, context),
  warn: (event: string, context?: Record<string, unknown>) =>
    emit("warn", event, context),
  error: (event: string, context?: Record<string, unknown>) =>
    emit("error", event, context),
};
