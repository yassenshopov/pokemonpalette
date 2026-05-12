import { PrismaClient, Prisma } from "@prisma/client";
import { serverEnv } from "@/lib/env";

/**
 * Vercel-safe Prisma singleton.
 *
 * On Vercel, each function invocation may boot a fresh Node process. If we
 * `new PrismaClient()` per request we blow through Postgres's connection
 * limit quickly. Two things keep that bounded:
 *
 *   1. **pgbouncer pooler.** `DATABASE_URL` must point at the Supabase
 *      pooler on port 6543 with `?pgbouncer=true&connection_limit=1`. The
 *      `directUrl` in schema.prisma (port 5432) is only used by
 *      `prisma migrate`.
 *   2. **Process-wide singleton.** In dev we stash the client on
 *      `globalThis` so HMR doesn't leak clients on every save. In prod we
 *      still benefit when Vercel keeps the function warm.
 *
 * Logging: errors and warnings always; verbose query logs only when
 * explicitly requested via PRISMA_LOG=query so we don't dump PII into
 * Vercel's logs by accident.
 */

type PrismaLogLevel = Prisma.LogLevel;

function buildLog(): PrismaLogLevel[] {
  const level: PrismaLogLevel[] = ["error", "warn"];
  if (serverEnv.PRISMA_LOG === "query") {
    level.push("query");
  }
  return level;
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: buildLog(),
  });

if (serverEnv.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Re-export Prisma namespace so consumers can grab generated types (e.g.
// `Prisma.UserWhereInput`) without adding a second import.
export { Prisma };
