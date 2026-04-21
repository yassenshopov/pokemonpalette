import { createClient } from "@supabase/supabase-js";
import { clientEnv, serverEnv } from "./env";

/**
 * Supabase clients.
 *
 * NOTE on scope: we use Supabase ONLY for calling the SECURITY DEFINER
 * RPCs under `supabase/migrations/011-015`. All table CRUD goes through
 * Prisma (see `src/lib/prisma.ts`). That keeps types honest and connection
 * pooling consolidated.
 */

// Anon client for the browser. Reads hit RLS; writes require an auth'd
// session. Avoid using this on the server — use `supabaseAdmin` or Prisma.
export const supabase = createClient(
  clientEnv.NEXT_PUBLIC_SUPABASE_URL,
  clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

// Service-role client, server-only. Used for SECURITY DEFINER RPC calls
// where we want to bypass RLS on aggregate queries that the admin UI
// depends on. Accessing `serverEnv` on the client throws — so this export
// is only safe to consume from server modules.
export const supabaseAdmin =
  typeof window === "undefined"
    ? createClient(
        clientEnv.NEXT_PUBLIC_SUPABASE_URL,
        serverEnv.SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        },
      )
    : (null as never);
