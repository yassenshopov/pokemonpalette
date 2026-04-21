-- Admin daily-puzzle detail.
--
-- `admin_daily_puzzle_stats` aggregates a single day's daily_game_attempts
-- into one JSONB payload: headline KPIs, the attempts-to-solve histogram,
-- the hints histogram, and the ten most common *wrong* guesses. The sheet
-- that opens from the admin calendar uses this to avoid N round-trips.

CREATE OR REPLACE FUNCTION public.admin_daily_puzzle_stats(p_date date)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      id,
      user_id,
      target_pokemon_id,
      is_shiny,
      attempts,
      won,
      hints_used,
      pokemon_guessed,
      created_at,
      -- guesses is stored as JSONB (array of integer IDs); coalesce to
      -- an empty array so downstream UNNESTs are safe on empty rows.
      COALESCE(guesses, '[]'::jsonb) AS guesses
    FROM daily_game_attempts
    WHERE date = p_date
  ),
  totals AS (
    SELECT
      COUNT(*)::bigint                                          AS attempts_total,
      COUNT(DISTINCT user_id)::bigint                           AS unique_players,
      COUNT(*) FILTER (WHERE won)::bigint                       AS wins,
      COUNT(*) FILTER (WHERE NOT won)::bigint                   AS losses,
      COUNT(*) FILTER (WHERE is_shiny)::bigint                  AS shiny_attempts,
      COALESCE(ROUND(AVG(attempts)::numeric, 2), 0)             AS avg_attempts,
      COALESCE(ROUND(AVG(attempts) FILTER (WHERE won)::numeric, 2), 0)
                                                                AS avg_attempts_win,
      COALESCE(ROUND(AVG(hints_used)::numeric, 2), 0)           AS avg_hints,
      MAX(target_pokemon_id)                                    AS target_pokemon_id,
      MIN(created_at) FILTER (WHERE won)                        AS first_solved_at,
      MIN(attempts)   FILTER (WHERE won)                        AS fastest_attempts,
      MIN(created_at)                                           AS first_play_at,
      MAX(created_at)                                           AS last_play_at
    FROM base
  ),
  attempts_hist AS (
    SELECT
      LEAST(GREATEST(attempts, 1), 7) AS bucket,
      COUNT(*)::bigint                AS c,
      COUNT(*) FILTER (WHERE won)::bigint AS wins
    FROM base
    GROUP BY 1
    ORDER BY 1
  ),
  hints_hist AS (
    SELECT
      LEAST(COALESCE(hints_used, 0), 3) AS bucket,
      COUNT(*)::bigint                   AS c
    FROM base
    GROUP BY 1
    ORDER BY 1
  ),
  top_guesses AS (
    SELECT t.g AS pokemon_id, COUNT(*)::bigint AS c
    FROM base
    CROSS JOIN LATERAL (
      SELECT (elem)::int AS g
      FROM jsonb_array_elements_text(base.guesses) AS elem
    ) AS t
    WHERE t.g <> base.target_pokemon_id
    GROUP BY t.g
    ORDER BY c DESC, pokemon_id ASC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'kpis', (
      SELECT jsonb_build_object(
        'attempts',          attempts_total,
        'unique_players',    unique_players,
        'wins',              wins,
        'losses',            losses,
        'shiny_attempts',    shiny_attempts,
        'avg_attempts',      avg_attempts,
        'avg_attempts_win',  avg_attempts_win,
        'avg_hints',         avg_hints,
        'first_solved_at',   first_solved_at,
        'fastest_attempts',  fastest_attempts,
        'first_play_at',     first_play_at,
        'last_play_at',      last_play_at,
        'target_pokemon_id', target_pokemon_id
      )
      FROM totals
    ),
    'attempts_histogram', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'bucket', bucket, 'count', c, 'wins', wins
      ) ORDER BY bucket) FROM attempts_hist),
      '[]'::jsonb
    ),
    'hints_histogram', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'bucket', bucket, 'count', c
      ) ORDER BY bucket) FROM hints_hist),
      '[]'::jsonb
    ),
    'top_wrong_guesses', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'pokemon_id', pokemon_id, 'count', c
      )) FROM top_guesses),
      '[]'::jsonb
    )
  );
$$;

REVOKE ALL ON FUNCTION public.admin_daily_puzzle_stats(date) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_daily_puzzle_stats(date) TO authenticated, service_role;

COMMENT ON FUNCTION public.admin_daily_puzzle_stats(date) IS
  'Aggregated stats for a single daily puzzle. Powers the admin calendar day-drawer.';
