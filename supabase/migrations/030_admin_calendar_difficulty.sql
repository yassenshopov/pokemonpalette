-- Migration 030: Difficulty filter on admin_game_calendar.
--
-- Migration 029 added per-difficulty rows to `daily_game_attempts` but the
-- admin month-grid / contribution-graph RPC (`admin_game_calendar`) was
-- left aggregating across BOTH difficulties. That conflates a day's
-- easy-mode and hard-mode plays into a single row, which:
--   * inflates `attempts_count` / `unique_players` once hard plays land,
--   * makes `max(target_pokemon_id)` non-deterministic when the two
--     tracks resolved to different Pokémon on the same date,
--   * gives admins no way to compare easy vs. hard performance at a
--     glance from the calendar view.
--
-- This migration adds an explicit `p_difficulty` filter with a default
-- of 'easy' so any legacy caller (none currently in tree, but defense
-- in depth) keeps seeing the pre-migration shape — the easy-only roll-up.

DROP FUNCTION IF EXISTS public.admin_game_calendar(date, date);

CREATE OR REPLACE FUNCTION public.admin_game_calendar(
  p_from       date,
  p_to         date,
  p_difficulty text DEFAULT 'easy'
)
RETURNS TABLE (
  day               date,
  target_pokemon_id int,
  attempts_count    bigint,
  wins              bigint,
  unique_players    bigint,
  avg_attempts      numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    date AS day,
    max(target_pokemon_id)::int          AS target_pokemon_id,
    count(*)::bigint                     AS attempts_count,
    count(*) FILTER (WHERE won)::bigint  AS wins,
    count(DISTINCT user_id)::bigint      AS unique_players,
    round(avg(attempts)::numeric, 2)     AS avg_attempts
  FROM public.daily_game_attempts
  WHERE date >= p_from
    AND date <= p_to
    AND difficulty = p_difficulty
  GROUP BY date
  ORDER BY date;
$$;

-- Re-apply the same access policy as migration 014 (the 2-arg version
-- of this function was locked to service_role; recreate the lockdown
-- against the new 3-arg signature). Without this, the new function
-- would inherit Postgres's default GRANT EXECUTE TO PUBLIC and bypass
-- the admin-only contract the rest of the dashboard depends on.
REVOKE ALL ON FUNCTION public.admin_game_calendar(date, date, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_game_calendar(date, date, text)
  TO service_role;
