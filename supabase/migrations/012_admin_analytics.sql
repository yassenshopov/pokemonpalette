-- Admin analytics helpers.
--
-- `admin_overview_stats` powers the /admin Overview dashboard. It accepts the
-- current range and a "previous" range of equal length so every KPI can be
-- rendered with a delta vs. the prior period. Daily series are zero-filled
-- across the full span using generate_series, and leaderboards + distributions
-- are scoped to the current range.
--
-- `admin_game_calendar` feeds the month-grid view on the Game tab.

CREATE OR REPLACE FUNCTION public.admin_overview_stats(
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
  date_span AS (
    SELECT generate_series(
      date_trunc('day', p_from)::date,
      (date_trunc('day', p_to) - interval '1 day')::date,
      interval '1 day'
    )::date AS d
  ),
  attempts_cur AS (
    SELECT id, user_id, target_pokemon_id, is_shiny, won,
           attempts, hints_used, created_at, date
    FROM public.daily_game_attempts
    WHERE created_at >= p_from AND created_at < p_to
  ),
  attempts_prev AS (
    SELECT id, won, attempts
    FROM public.daily_game_attempts
    WHERE created_at >= p_prev_from AND created_at < p_prev_to
  ),
  signups_cur AS (
    SELECT id, created_at
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
  active_cur AS (
    SELECT count(*)::bigint AS c
    FROM public.users
    WHERE is_deleted = false
      AND last_active_at >= p_from AND last_active_at < p_to
  ),
  active_prev AS (
    SELECT count(*)::bigint AS c
    FROM public.users
    WHERE is_deleted = false
      AND last_active_at >= p_prev_from AND last_active_at < p_prev_to
  ),
  palettes_cur AS (
    SELECT id, pokemon_id, pokemon_name, created_at
    FROM public.saved_palettes
    WHERE created_at >= p_from AND created_at < p_to
  ),
  palettes_prev AS (
    SELECT count(*)::bigint AS c
    FROM public.saved_palettes
    WHERE created_at >= p_prev_from AND created_at < p_prev_to
  ),
  -- per-day aggregates
  signups_by_day AS (
    SELECT date_trunc('day', created_at)::date AS d, count(*)::bigint AS c
    FROM signups_cur GROUP BY 1
  ),
  attempts_by_day AS (
    SELECT date_trunc('day', created_at)::date AS d, count(*)::bigint AS c
    FROM attempts_cur GROUP BY 1
  ),
  wins_by_day AS (
    SELECT date_trunc('day', created_at)::date AS d, count(*)::bigint AS c
    FROM attempts_cur WHERE won = true GROUP BY 1
  ),
  palettes_by_day AS (
    SELECT date_trunc('day', created_at)::date AS d, count(*)::bigint AS c
    FROM palettes_cur GROUP BY 1
  ),
  active_by_day AS (
    SELECT date_trunc('day', created_at)::date AS d,
           count(DISTINCT user_id)::bigint AS c
    FROM attempts_cur GROUP BY 1
  ),
  -- zero-filled
  signups_filled AS (
    SELECT ds.d, COALESCE(s.c, 0) AS c
    FROM date_span ds LEFT JOIN signups_by_day s ON s.d = ds.d ORDER BY ds.d
  ),
  attempts_filled AS (
    SELECT ds.d, COALESCE(s.c, 0) AS c
    FROM date_span ds LEFT JOIN attempts_by_day s ON s.d = ds.d ORDER BY ds.d
  ),
  wins_filled AS (
    SELECT ds.d, COALESCE(s.c, 0) AS c
    FROM date_span ds LEFT JOIN wins_by_day s ON s.d = ds.d ORDER BY ds.d
  ),
  palettes_filled AS (
    SELECT ds.d, COALESCE(s.c, 0) AS c
    FROM date_span ds LEFT JOIN palettes_by_day s ON s.d = ds.d ORDER BY ds.d
  ),
  active_filled AS (
    SELECT ds.d, COALESCE(s.c, 0) AS c
    FROM date_span ds LEFT JOIN active_by_day s ON s.d = ds.d ORDER BY ds.d
  ),
  -- totals
  totals AS (
    SELECT
      (SELECT count(*)::bigint FROM public.users WHERE is_deleted = false) AS total_users,
      (SELECT count(*)::bigint FROM signups_cur) AS signups,
      (SELECT c FROM signups_prev) AS signups_prev,
      (SELECT c FROM active_cur) AS active_users,
      (SELECT c FROM active_prev) AS active_prev,
      (SELECT count(*)::bigint FROM attempts_cur) AS attempts,
      (SELECT count(*)::bigint FROM attempts_prev) AS attempts_prev,
      (SELECT count(*) FILTER (WHERE won)::bigint FROM attempts_cur) AS wins,
      (SELECT count(*) FILTER (WHERE won)::bigint FROM attempts_prev) AS wins_prev,
      (SELECT round(avg(attempts)::numeric, 2) FROM attempts_cur) AS avg_attempts,
      (SELECT round(avg(attempts)::numeric, 2) FROM attempts_prev) AS avg_attempts_prev,
      (SELECT count(DISTINCT user_id)::bigint FROM attempts_cur) AS unique_players,
      (SELECT count(*)::bigint FROM palettes_cur) AS palettes,
      (SELECT c FROM palettes_prev) AS palettes_prev
  ),
  -- leaderboards (current range)
  top_players AS (
    SELECT user_id,
           count(*)::bigint AS attempts_count,
           count(*) FILTER (WHERE won)::bigint AS wins
    FROM attempts_cur
    GROUP BY user_id
    ORDER BY attempts_count DESC
    LIMIT 10
  ),
  top_targets AS (
    SELECT target_pokemon_id,
           count(*)::bigint AS c,
           count(*) FILTER (WHERE won)::bigint AS wins
    FROM attempts_cur
    GROUP BY target_pokemon_id
    ORDER BY c DESC
    LIMIT 10
  ),
  top_palette_pokemon AS (
    SELECT pokemon_id, pokemon_name, count(*)::bigint AS c
    FROM palettes_cur
    GROUP BY pokemon_id, pokemon_name
    ORDER BY c DESC
    LIMIT 10
  ),
  -- distributions
  attempts_hist AS (
    SELECT CASE WHEN attempts >= 7 THEN 7 ELSE attempts END AS bucket,
           count(*)::bigint AS c
    FROM attempts_cur
    GROUP BY 1
    ORDER BY 1
  ),
  hints_hist AS (
    SELECT CASE WHEN hints_used >= 3 THEN 3 ELSE hints_used END AS bucket,
           count(*)::bigint AS c
    FROM attempts_cur
    GROUP BY 1
    ORDER BY 1
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'totalUsers',         (SELECT total_users FROM totals),
      'newSignups',         (SELECT signups FROM totals),
      'newSignupsPrev',     (SELECT signups_prev FROM totals),
      'activeUsers',        (SELECT active_users FROM totals),
      'activeUsersPrev',    (SELECT active_prev FROM totals),
      'attempts',           (SELECT attempts FROM totals),
      'attemptsPrev',       (SELECT attempts_prev FROM totals),
      'wins',               (SELECT wins FROM totals),
      'winsPrev',           (SELECT wins_prev FROM totals),
      'winRate',            CASE WHEN (SELECT attempts FROM totals) = 0 THEN 0
                                 ELSE round(((SELECT wins FROM totals)::numeric
                                           / (SELECT attempts FROM totals)::numeric) * 100, 2) END,
      'winRatePrev',        CASE WHEN (SELECT attempts_prev FROM totals) = 0 THEN 0
                                 ELSE round(((SELECT wins_prev FROM totals)::numeric
                                           / (SELECT attempts_prev FROM totals)::numeric) * 100, 2) END,
      'avgAttempts',        COALESCE((SELECT avg_attempts FROM totals), 0),
      'avgAttemptsPrev',    COALESCE((SELECT avg_attempts_prev FROM totals), 0),
      'uniquePlayers',      (SELECT unique_players FROM totals),
      'palettes',           (SELECT palettes FROM totals),
      'palettesPrev',       (SELECT palettes_prev FROM totals)
    ),
    'series', jsonb_build_object(
      'signups',  COALESCE((SELECT jsonb_agg(jsonb_build_object('date', to_char(d,'YYYY-MM-DD'), 'count', c)) FROM signups_filled), '[]'::jsonb),
      'attempts', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', to_char(d,'YYYY-MM-DD'), 'count', c)) FROM attempts_filled), '[]'::jsonb),
      'wins',     COALESCE((SELECT jsonb_agg(jsonb_build_object('date', to_char(d,'YYYY-MM-DD'), 'count', c)) FROM wins_filled),     '[]'::jsonb),
      'palettes', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', to_char(d,'YYYY-MM-DD'), 'count', c)) FROM palettes_filled), '[]'::jsonb),
      'active',   COALESCE((SELECT jsonb_agg(jsonb_build_object('date', to_char(d,'YYYY-MM-DD'), 'count', c)) FROM active_filled),   '[]'::jsonb)
    ),
    'leaderboards', jsonb_build_object(
      'topPlayers',        COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id', user_id, 'attempts', attempts_count, 'wins', wins)) FROM top_players),       '[]'::jsonb),
      'topTargets',        COALESCE((SELECT jsonb_agg(jsonb_build_object('target_pokemon_id', target_pokemon_id, 'count', c, 'wins', wins)) FROM top_targets),   '[]'::jsonb),
      'topPalettePokemon', COALESCE((SELECT jsonb_agg(jsonb_build_object('pokemon_id', pokemon_id, 'pokemon_name', pokemon_name, 'count', c)) FROM top_palette_pokemon), '[]'::jsonb)
    ),
    'distributions', jsonb_build_object(
      'attempts', COALESCE((SELECT jsonb_agg(jsonb_build_object('bucket', bucket, 'count', c) ORDER BY bucket) FROM attempts_hist), '[]'::jsonb),
      'hints',    COALESCE((SELECT jsonb_agg(jsonb_build_object('bucket', bucket, 'count', c) ORDER BY bucket) FROM hints_hist),    '[]'::jsonb)
    )
  );
$$;

-- Calendar month-view aggregate. Returns one row per puzzle date within range.
CREATE OR REPLACE FUNCTION public.admin_game_calendar(
  p_from date,
  p_to   date
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
  WHERE date >= p_from AND date <= p_to
  GROUP BY date
  ORDER BY date;
$$;
