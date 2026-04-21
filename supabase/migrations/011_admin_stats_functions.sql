-- Admin stats helpers.
--
-- Server-side aggregate functions used by the admin overview and per-tab
-- stats endpoints. Each returns a single JSON blob so the API route can
-- forward it with minimal transformation. Running aggregation in SQL is
-- dramatically faster than pulling rows into the app layer, even for modest
-- datasets, and it sidesteps the 1000-row PostgREST default.

CREATE OR REPLACE FUNCTION public.admin_palette_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT pokemon_id, pokemon_name, is_shiny
    FROM public.saved_palettes
  ),
  totals AS (
    SELECT
      count(*)::bigint AS total_palettes,
      count(*) FILTER (WHERE is_shiny)::bigint AS shiny_count,
      count(DISTINCT pokemon_id)::bigint AS unique_pokemon
    FROM base
  ),
  top_pokemon AS (
    SELECT pokemon_name, pokemon_id, count(*)::bigint AS c
    FROM base
    GROUP BY pokemon_name, pokemon_id
    ORDER BY c DESC
    LIMIT 5
  )
  SELECT jsonb_build_object(
    'totalPalettes', (SELECT total_palettes FROM totals),
    'shinyCount', (SELECT shiny_count FROM totals),
    'regularCount', (SELECT total_palettes - shiny_count FROM totals),
    'uniquePokemon', (SELECT unique_pokemon FROM totals),
    'topPokemon', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', pokemon_name,
        'count', c,
        'pokemon_id', pokemon_id
      ))
      FROM top_pokemon
    ), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_game_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT user_id, won, attempts, hints_used, date, target_pokemon_id
    FROM public.daily_game_attempts
  ),
  totals AS (
    SELECT
      count(*)::bigint AS total_attempts,
      count(*) FILTER (WHERE won)::bigint AS wins,
      avg(attempts)::numeric AS avg_attempts,
      avg(hints_used)::numeric AS avg_hints,
      count(DISTINCT user_id)::bigint AS unique_players,
      count(DISTINCT date)::bigint AS unique_dates
    FROM base
  ),
  top_targets AS (
    SELECT target_pokemon_id, count(*)::bigint AS c
    FROM base
    GROUP BY target_pokemon_id
    ORDER BY c DESC
    LIMIT 5
  )
  SELECT jsonb_build_object(
    'totalAttempts', (SELECT total_attempts FROM totals),
    'wins', (SELECT wins FROM totals),
    'losses', (SELECT total_attempts - wins FROM totals),
    'winRate', CASE
      WHEN (SELECT total_attempts FROM totals) = 0 THEN 0
      ELSE round(
        ((SELECT wins FROM totals)::numeric
         / (SELECT total_attempts FROM totals)::numeric) * 100, 2
      )
    END,
    'avgAttempts', COALESCE(round((SELECT avg_attempts FROM totals), 2), 0),
    'avgHints', COALESCE(round((SELECT avg_hints FROM totals), 2), 0),
    'uniquePlayers', (SELECT unique_players FROM totals),
    'uniqueDates', (SELECT unique_dates FROM totals),
    'topTargets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'target_pokemon_id', target_pokemon_id,
        'count', c
      ))
      FROM top_targets
    ), '[]'::jsonb)
  );
$$;

-- Per-day aggregate used by the "Daily puzzles" view on the game tab.
CREATE OR REPLACE FUNCTION public.admin_game_daily(p_page int, p_page_size int)
RETURNS TABLE (
  date date,
  target_pokemon_id int,
  attempts_count bigint,
  wins bigint,
  avg_attempts numeric,
  avg_hints numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    date,
    max(target_pokemon_id)::int AS target_pokemon_id,
    count(*)::bigint AS attempts_count,
    count(*) FILTER (WHERE won)::bigint AS wins,
    round(avg(attempts)::numeric, 2) AS avg_attempts,
    round(avg(hints_used)::numeric, 2) AS avg_hints
  FROM public.daily_game_attempts
  GROUP BY date
  ORDER BY date DESC
  OFFSET GREATEST(p_page - 1, 0) * GREATEST(p_page_size, 1)
  LIMIT GREATEST(p_page_size, 1);
$$;

CREATE OR REPLACE FUNCTION public.admin_game_daily_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(DISTINCT date)::bigint FROM public.daily_game_attempts;
$$;

-- Per-player aggregate for the "By user" view.
CREATE OR REPLACE FUNCTION public.admin_game_by_user(p_page int, p_page_size int)
RETURNS TABLE (
  user_id text,
  attempts_count bigint,
  wins bigint,
  last_played timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    user_id,
    count(*)::bigint AS attempts_count,
    count(*) FILTER (WHERE won)::bigint AS wins,
    max(created_at) AS last_played
  FROM public.daily_game_attempts
  GROUP BY user_id
  ORDER BY attempts_count DESC
  OFFSET GREATEST(p_page - 1, 0) * GREATEST(p_page_size, 1)
  LIMIT GREATEST(p_page_size, 1);
$$;

CREATE OR REPLACE FUNCTION public.admin_game_by_user_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(DISTINCT user_id)::bigint FROM public.daily_game_attempts;
$$;
