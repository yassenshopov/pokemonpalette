-- Migration 020: Admin "Insights" dashboard
--
-- Powers /admin/insights, a higher-level growth view for the game and
-- saved-palettes products. Three lenses live on that page:
--
--   1) Cumulative growth: an all-time daily series of attempts and saved
--      palettes so the running total of each can be charted side-by-side.
--      Zero-filled across the active span [first_event_day, today].
--
--   2) Activity heatmap: the last 365 days of daily counts (attempts +
--      palettes, separately) for a GitHub-style contribution calendar.
--      Range-independent so the calendar always shows a year's pulse.
--
--   3) Pokédex coverage map: per-Pokémon all-time totals — how many times
--      it has appeared as a daily target, how many of those were wins, and
--      how many times it has been saved as a palette. The client renders
--      this as a heat-grid keyed by Pokédex number.
--
-- Range-bound KPIs (current + previous period delta) are also returned so
-- the page can show "in this period" cards alongside the all-time map.
--
-- The function is SECURITY DEFINER and locked to service_role, matching
-- the rest of the admin_* RPCs (see migration 014).

CREATE OR REPLACE FUNCTION public.admin_insights_stats(
  p_from       timestamptz,
  p_to         timestamptz,
  p_prev_from  timestamptz,
  p_prev_to    timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  -- ----- range-scoped subqueries ------------------------------------------
  attempts_cur AS (
    SELECT id, user_id, target_pokemon_id, won, attempts, created_at
    FROM public.daily_game_attempts
    WHERE created_at >= p_from AND created_at < p_to
  ),
  attempts_prev AS (
    SELECT id, won
    FROM public.daily_game_attempts
    WHERE created_at >= p_prev_from AND created_at < p_prev_to
  ),
  palettes_cur AS (
    SELECT id, user_id, pokemon_id, pokemon_name, created_at
    FROM public.saved_palettes
    WHERE created_at >= p_from AND created_at < p_to
  ),
  palettes_prev AS (
    SELECT id
    FROM public.saved_palettes
    WHERE created_at >= p_prev_from AND created_at < p_prev_to
  ),
  signups_cur AS (
    SELECT id
    FROM public.users
    WHERE is_deleted = false
      AND created_at >= p_from AND created_at < p_to
  ),
  signups_prev AS (
    SELECT count(*)::bigint AS c
    FROM public.users
    WHERE is_deleted = false
      AND created_at >= p_prev_from AND created_at < p_prev_to
  ),

  -- ----- range KPIs -------------------------------------------------------
  range_kpis AS (
    SELECT
      (SELECT count(*)::bigint                          FROM attempts_cur)  AS attempts,
      (SELECT count(*)::bigint                          FROM attempts_prev) AS attempts_prev,
      (SELECT count(*) FILTER (WHERE won)::bigint       FROM attempts_cur)  AS wins,
      (SELECT count(*) FILTER (WHERE won)::bigint       FROM attempts_prev) AS wins_prev,
      (SELECT count(*)::bigint                          FROM palettes_cur)  AS palettes,
      (SELECT count(*)::bigint                          FROM palettes_prev) AS palettes_prev,
      (SELECT count(DISTINCT user_id)::bigint           FROM attempts_cur)  AS unique_players,
      (SELECT count(DISTINCT user_id)::bigint           FROM palettes_cur)  AS unique_palettists,
      (SELECT count(DISTINCT target_pokemon_id)::bigint FROM attempts_cur)  AS pokemon_targeted,
      (SELECT count(DISTINCT pokemon_id)::bigint        FROM palettes_cur)  AS pokemon_palettized,
      (SELECT count(*)::bigint                          FROM signups_cur)   AS signups,
      (SELECT c                                         FROM signups_prev)  AS signups_prev
  ),

  -- ----- all-time totals --------------------------------------------------
  totals AS (
    SELECT
      (SELECT count(*)::bigint                          FROM public.daily_game_attempts)             AS attempts_all,
      (SELECT count(*) FILTER (WHERE won)::bigint       FROM public.daily_game_attempts)             AS wins_all,
      (SELECT count(*)::bigint                          FROM public.saved_palettes)                  AS palettes_all,
      (SELECT count(DISTINCT user_id)::bigint           FROM public.daily_game_attempts)             AS players_all,
      (SELECT count(DISTINCT user_id)::bigint           FROM public.saved_palettes)                  AS palettists_all,
      (SELECT count(DISTINCT target_pokemon_id)::bigint FROM public.daily_game_attempts)             AS pokemon_targeted_all,
      (SELECT count(DISTINCT pokemon_id)::bigint        FROM public.saved_palettes)                  AS pokemon_palettized_all,
      (SELECT count(*)::bigint                          FROM public.users WHERE is_deleted = false)  AS users_all
  ),

  -- ----- range daily series (zero-filled) ---------------------------------
  range_span AS (
    SELECT generate_series(
      date_trunc('day', p_from)::date,
      (date_trunc('day', p_to) - interval '1 day')::date,
      interval '1 day'
    )::date AS d
  ),
  range_attempts_by_day AS (
    SELECT date_trunc('day', created_at)::date AS d, count(*)::bigint AS c
    FROM attempts_cur GROUP BY 1
  ),
  range_palettes_by_day AS (
    SELECT date_trunc('day', created_at)::date AS d, count(*)::bigint AS c
    FROM palettes_cur GROUP BY 1
  ),
  range_attempts_filled AS (
    SELECT rs.d, COALESCE(a.c, 0) AS c
    FROM range_span rs LEFT JOIN range_attempts_by_day a ON a.d = rs.d ORDER BY rs.d
  ),
  range_palettes_filled AS (
    SELECT rs.d, COALESCE(p.c, 0) AS c
    FROM range_span rs LEFT JOIN range_palettes_by_day p ON p.d = rs.d ORDER BY rs.d
  ),

  -- ----- all-time daily series (cumulative line chart) --------------------
  --
  -- Anchor the span at the earliest event we've seen across either feature
  -- so the chart always starts where the data starts. If there's no data
  -- yet, fall back to today so generate_series doesn't bottom out.
  all_time_start AS (
    SELECT date_trunc('day', LEAST(
      COALESCE((SELECT min(created_at) FROM public.daily_game_attempts), now()),
      COALESCE((SELECT min(created_at) FROM public.saved_palettes),       now())
    ))::date AS d
  ),
  all_time_span AS (
    SELECT generate_series(
      (SELECT d FROM all_time_start),
      date_trunc('day', now())::date,
      interval '1 day'
    )::date AS d
  ),
  all_attempts_by_day AS (
    SELECT date_trunc('day', created_at)::date AS d, count(*)::bigint AS c
    FROM public.daily_game_attempts GROUP BY 1
  ),
  all_palettes_by_day AS (
    SELECT date_trunc('day', created_at)::date AS d, count(*)::bigint AS c
    FROM public.saved_palettes GROUP BY 1
  ),
  all_attempts_filled AS (
    SELECT ats.d, COALESCE(a.c, 0) AS c
    FROM all_time_span ats LEFT JOIN all_attempts_by_day a ON a.d = ats.d ORDER BY ats.d
  ),
  all_palettes_filled AS (
    SELECT ats.d, COALESCE(p.c, 0) AS c
    FROM all_time_span ats LEFT JOIN all_palettes_by_day p ON p.d = ats.d ORDER BY ats.d
  ),

  -- ----- 365-day heatmap series ------------------------------------------
  --
  -- The heatmap is range-independent — it always shows the trailing year so
  -- admins get a stable contribution-graph view. We anchor on UTC midnight
  -- to keep cell boundaries deterministic.
  heatmap_span AS (
    SELECT generate_series(
      (date_trunc('day', now()) - interval '364 days')::date,
      date_trunc('day', now())::date,
      interval '1 day'
    )::date AS d
  ),
  heatmap_attempts_by_day AS (
    SELECT date_trunc('day', created_at)::date AS d, count(*)::bigint AS c
    FROM public.daily_game_attempts
    WHERE created_at >= now() - interval '365 days'
    GROUP BY 1
  ),
  heatmap_palettes_by_day AS (
    SELECT date_trunc('day', created_at)::date AS d, count(*)::bigint AS c
    FROM public.saved_palettes
    WHERE created_at >= now() - interval '365 days'
    GROUP BY 1
  ),
  heatmap_attempts_filled AS (
    SELECT hs.d, COALESCE(a.c, 0) AS c
    FROM heatmap_span hs LEFT JOIN heatmap_attempts_by_day a ON a.d = hs.d ORDER BY hs.d
  ),
  heatmap_palettes_filled AS (
    SELECT hs.d, COALESCE(p.c, 0) AS c
    FROM heatmap_span hs LEFT JOIN heatmap_palettes_by_day p ON p.d = hs.d ORDER BY hs.d
  ),

  -- ----- Pokédex coverage (all-time, merged) ------------------------------
  --
  -- Combine target + palette signals into one row per Pokémon. The client
  -- can decide how to weight them; we surface raw counts plus a simple
  -- 1×attempts + 3×palettes "engagement" score so the UI can sort/heat by
  -- a single number out-of-the-box.
  attempts_by_pokemon AS (
    SELECT target_pokemon_id AS pokemon_id,
           count(*)::bigint AS attempts,
           count(*) FILTER (WHERE won)::bigint AS wins
    FROM public.daily_game_attempts
    GROUP BY target_pokemon_id
  ),
  palettes_by_pokemon AS (
    SELECT pokemon_id,
           max(pokemon_name) AS pokemon_name,
           count(*)::bigint AS palettes
    FROM public.saved_palettes
    GROUP BY pokemon_id
  ),
  pokedex AS (
    SELECT
      COALESCE(a.pokemon_id, p.pokemon_id) AS pokemon_id,
      p.pokemon_name                       AS pokemon_name,
      COALESCE(a.attempts, 0)              AS attempts,
      COALESCE(a.wins,     0)              AS wins,
      COALESCE(p.palettes, 0)              AS palettes,
      (COALESCE(a.attempts, 0) + 3 * COALESCE(p.palettes, 0))::bigint AS score
    FROM attempts_by_pokemon a
    FULL OUTER JOIN palettes_by_pokemon p USING (pokemon_id)
  )

  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'attempts',           (SELECT attempts            FROM range_kpis),
      'attemptsPrev',       (SELECT attempts_prev       FROM range_kpis),
      'wins',               (SELECT wins                FROM range_kpis),
      'winsPrev',           (SELECT wins_prev           FROM range_kpis),
      'palettes',           (SELECT palettes            FROM range_kpis),
      'palettesPrev',       (SELECT palettes_prev       FROM range_kpis),
      'uniquePlayers',      (SELECT unique_players      FROM range_kpis),
      'uniquePalettists',   (SELECT unique_palettists   FROM range_kpis),
      'pokemonTargeted',    (SELECT pokemon_targeted    FROM range_kpis),
      'pokemonPalettized',  (SELECT pokemon_palettized  FROM range_kpis),
      'signups',            (SELECT signups             FROM range_kpis),
      'signupsPrev',        (SELECT signups_prev        FROM range_kpis),
      'winRate',            CASE WHEN (SELECT attempts FROM range_kpis) = 0 THEN 0
                                 ELSE round(((SELECT wins FROM range_kpis)::numeric
                                           / (SELECT attempts FROM range_kpis)::numeric) * 100, 2) END,
      'winRatePrev',        CASE WHEN (SELECT attempts_prev FROM range_kpis) = 0 THEN 0
                                 ELSE round(((SELECT wins_prev FROM range_kpis)::numeric
                                           / (SELECT attempts_prev FROM range_kpis)::numeric) * 100, 2) END
    ),
    'totals', jsonb_build_object(
      'attempts',          (SELECT attempts_all           FROM totals),
      'wins',              (SELECT wins_all               FROM totals),
      'palettes',          (SELECT palettes_all           FROM totals),
      'players',           (SELECT players_all            FROM totals),
      'palettists',        (SELECT palettists_all         FROM totals),
      'pokemonTargeted',   (SELECT pokemon_targeted_all   FROM totals),
      'pokemonPalettized', (SELECT pokemon_palettized_all FROM totals),
      'users',             (SELECT users_all              FROM totals)
    ),
    'series', jsonb_build_object(
      'rangeAttempts', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', to_char(d,'YYYY-MM-DD'), 'count', c)) FROM range_attempts_filled), '[]'::jsonb),
      'rangePalettes', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', to_char(d,'YYYY-MM-DD'), 'count', c)) FROM range_palettes_filled), '[]'::jsonb),
      'allAttempts',   COALESCE((SELECT jsonb_agg(jsonb_build_object('date', to_char(d,'YYYY-MM-DD'), 'count', c)) FROM all_attempts_filled),   '[]'::jsonb),
      'allPalettes',   COALESCE((SELECT jsonb_agg(jsonb_build_object('date', to_char(d,'YYYY-MM-DD'), 'count', c)) FROM all_palettes_filled),   '[]'::jsonb)
    ),
    'heatmap', jsonb_build_object(
      'attempts', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', to_char(d,'YYYY-MM-DD'), 'count', c)) FROM heatmap_attempts_filled), '[]'::jsonb),
      'palettes', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', to_char(d,'YYYY-MM-DD'), 'count', c)) FROM heatmap_palettes_filled), '[]'::jsonb)
    ),
    'pokedex', COALESCE(
      (SELECT jsonb_agg(
         jsonb_build_object(
           'pokemon_id',   pokemon_id,
           'pokemon_name', pokemon_name,
           'attempts',     attempts,
           'wins',         wins,
           'palettes',     palettes,
           'score',        score
         )
         ORDER BY score DESC, pokemon_id ASC
       )
       FROM pokedex
       WHERE pokemon_id IS NOT NULL),
      '[]'::jsonb
    )
  );
$$;

-- Lock down the new RPC the same way migration 014 locked the rest.
REVOKE ALL ON FUNCTION public.admin_insights_stats(timestamptz, timestamptz, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_insights_stats(timestamptz, timestamptz, timestamptz, timestamptz)
  TO service_role;
