-- Migration 014: lock down admin_* RPCs
--
-- Background: migrations 011 and 012 create SECURITY DEFINER functions that
-- aggregate admin analytics. Postgres defaults to GRANT EXECUTE ... TO PUBLIC
-- for new functions, which, combined with the anon key shipped to the
-- browser, means anyone can call them directly via PostgREST and retrieve
-- the entire admin dashboard payload. Migration 013 already did this
-- correctly for admin_daily_puzzle_stats; this migration applies the same
-- pattern to the rest.

-- 011 functions
REVOKE ALL ON FUNCTION public.admin_palette_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_palette_stats() TO service_role;

REVOKE ALL ON FUNCTION public.admin_game_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_game_stats() TO service_role;

REVOKE ALL ON FUNCTION public.admin_game_daily(int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_game_daily(int, int) TO service_role;

REVOKE ALL ON FUNCTION public.admin_game_daily_count() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_game_daily_count() TO service_role;

REVOKE ALL ON FUNCTION public.admin_game_by_user(int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_game_by_user(int, int) TO service_role;

REVOKE ALL ON FUNCTION public.admin_game_by_user_count() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_game_by_user_count() TO service_role;

-- 012 functions
REVOKE ALL ON FUNCTION public.admin_overview_stats(timestamptz, timestamptz, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_overview_stats(timestamptz, timestamptz, timestamptz, timestamptz) TO service_role;

REVOKE ALL ON FUNCTION public.admin_game_calendar(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_game_calendar(date, date) TO service_role;

-- Defense in depth: prevent future admin_* functions from being callable by
-- anon/authenticated by default. Requires explicit GRANT going forward.
-- (This is per-schema default; run once.)
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
