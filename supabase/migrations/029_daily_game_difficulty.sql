-- Migration 029: Hard difficulty mode for the daily game.
--
-- Adds a `difficulty` column to `daily_game_attempts` and `daily_overrides`
-- so players can complete two daily games per UTC day — the existing weekly
-- themed pool ("easy") and a full-Pokedex shiny-capable pool ("hard").
-- Streaks, stats, leaderboards, and admin overrides all stay split per
-- difficulty so a player's hard-mode performance doesn't backfill into
-- their existing easy-mode streak history.
--
-- Backfill: every existing row is "easy" — that's what was being played
-- before this migration shipped, so the historical leaderboard / streak
-- view stays identical. Going forward both modes are first-class.
--
-- The application code reads `difficulty` from the query string (game
-- routes) and the JSON body (POST attempts). All RPCs grow a
-- `p_difficulty` arg defaulting to 'easy' so callers that haven't been
-- updated yet keep seeing easy-mode numbers (legacy behavior).

-- ---------------------------------------------------------------------------
-- daily_game_attempts
-- ---------------------------------------------------------------------------

ALTER TABLE public.daily_game_attempts
  ADD COLUMN IF NOT EXISTS difficulty TEXT NOT NULL DEFAULT 'easy'
  CHECK (difficulty IN ('easy', 'hard'));

COMMENT ON COLUMN public.daily_game_attempts.difficulty IS
  'Game difficulty for this attempt. "easy" = themed weekly pool, "hard" = full Pokedex + shiny chance.';

-- The original `UNIQUE(user_id, date)` would block the same user from
-- completing both difficulties on the same UTC day. Drop it and replace
-- with a 3-column unique that lets each user have one attempt per
-- (date, difficulty) combination.
--
-- The constraint name from migration 003 follows Postgres's default
-- naming scheme: `<table>_<col>_<col>_key`. We DROP IF EXISTS to stay
-- robust to manual rename history.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'daily_game_attempts_user_id_date_key'
      AND conrelid = 'public.daily_game_attempts'::regclass
  ) THEN
    ALTER TABLE public.daily_game_attempts
      DROP CONSTRAINT daily_game_attempts_user_id_date_key;
  END IF;
END $$;

ALTER TABLE public.daily_game_attempts
  ADD CONSTRAINT daily_game_attempts_user_id_date_difficulty_key
  UNIQUE (user_id, date, difficulty);

-- Useful for the per-difficulty stats queries below.
CREATE INDEX IF NOT EXISTS idx_dga_user_difficulty_date_desc
  ON public.daily_game_attempts (user_id, difficulty, date DESC);

CREATE INDEX IF NOT EXISTS idx_dga_date_difficulty
  ON public.daily_game_attempts (date, difficulty);

-- ---------------------------------------------------------------------------
-- daily_overrides
-- ---------------------------------------------------------------------------

ALTER TABLE public.daily_overrides
  ADD COLUMN IF NOT EXISTS difficulty TEXT NOT NULL DEFAULT 'easy'
  CHECK (difficulty IN ('easy', 'hard'));

COMMENT ON COLUMN public.daily_overrides.difficulty IS
  'Which difficulty this admin-pinned target applies to. Each (date, difficulty) pair can have at most one override.';

-- `daily_overrides` had `PRIMARY KEY (date)`. We need `(date, difficulty)`
-- so the admin can pin both modes on the same date. Postgres names the
-- PK constraint `<table>_pkey` by default.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'daily_overrides_pkey'
      AND conrelid = 'public.daily_overrides'::regclass
  ) THEN
    ALTER TABLE public.daily_overrides
      DROP CONSTRAINT daily_overrides_pkey;
  END IF;
END $$;

ALTER TABLE public.daily_overrides
  ADD CONSTRAINT daily_overrides_pkey PRIMARY KEY (date, difficulty);

-- ---------------------------------------------------------------------------
-- user_game_stats — per-difficulty aggregates.
--
-- Drops the old single-arg signature (which always aggregated every row)
-- and replaces it with a two-arg form that filters on difficulty. The
-- app always passes a difficulty now; the default 'easy' keeps any
-- service-role caller that hasn't been redeployed yet on the legacy
-- behavior.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.user_game_stats(text);

CREATE OR REPLACE FUNCTION public.user_game_stats(
  p_user_id    text,
  p_difficulty text DEFAULT 'easy'
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH per_user AS (
    SELECT
      COUNT(*)                                 AS total_games,
      COUNT(*) FILTER (WHERE won)              AS total_wins,
      COUNT(*) FILTER (WHERE NOT won)          AS total_losses,
      COUNT(*) FILTER (WHERE won) * 100.0
        / NULLIF(COUNT(*), 0)                  AS win_rate,
      AVG(attempts)::numeric                   AS avg_attempts
    FROM daily_game_attempts
    WHERE user_id = p_user_id
      AND difficulty = p_difficulty
  ),
  won_days AS (
    SELECT
      date,
      date - (ROW_NUMBER() OVER (ORDER BY date))::int AS grp
    FROM daily_game_attempts
    WHERE user_id = p_user_id
      AND difficulty = p_difficulty
      AND won
  ),
  streaks AS (
    SELECT COUNT(*) AS streak_len, MAX(date) AS streak_end
    FROM won_days
    GROUP BY grp
  )
  SELECT jsonb_build_object(
    'totalGames',      COALESCE(pu.total_games, 0),
    'totalWins',       COALESCE(pu.total_wins, 0),
    'totalLosses',     COALESCE(pu.total_losses, 0),
    'winRate',         ROUND(COALESCE(pu.win_rate, 0)::numeric, 2),
    'averageAttempts', ROUND(COALESCE(pu.avg_attempts, 0), 2),
    'currentStreak',   COALESCE((
      SELECT streak_len FROM streaks
      WHERE streak_end >= (now() AT TIME ZONE 'UTC')::date - INTERVAL '1 day'
      ORDER BY streak_end DESC LIMIT 1
    ), 0),
    'longestStreak',   COALESCE((SELECT MAX(streak_len) FROM streaks), 0)
  )
  FROM per_user pu;
$$;

REVOKE ALL ON FUNCTION public.user_game_stats(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_game_stats(text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- daily_puzzle_leaderboard — per-difficulty daily board.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.daily_puzzle_leaderboard(date, int);

CREATE OR REPLACE FUNCTION public.daily_puzzle_leaderboard(
  p_date       date,
  p_limit      int DEFAULT 10,
  p_difficulty text DEFAULT 'easy'
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT
      a.user_id,
      a.attempts,
      a.hints_used,
      a.won,
      a.created_at,
      ROW_NUMBER() OVER (
        ORDER BY
          a.won DESC,
          CASE WHEN a.won THEN a.attempts   END ASC NULLS LAST,
          CASE WHEN a.won THEN a.hints_used END ASC NULLS LAST,
          a.created_at ASC
      )::int AS rank
    FROM daily_game_attempts a
    WHERE a.date = p_date
      AND a.difficulty = p_difficulty
  ),
  top AS (
    SELECT r.*, u.username, u.first_name, u.last_name, u.image_url
    FROM ranked r
    LEFT JOIN users u ON u.id = r.user_id AND u.is_deleted = false
    ORDER BY r.rank
    LIMIT GREATEST(1, LEAST(50, p_limit))
  )
  SELECT jsonb_build_object(
    'date',         p_date,
    'difficulty',   p_difficulty,
    'totalPlayers', (SELECT COUNT(*) FROM ranked),
    'entries', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'rank',      t.rank,
          'userId',    t.user_id,
          'username',  t.username,
          'firstName', t.first_name,
          'lastName',  t.last_name,
          'imageUrl',  t.image_url,
          'attempts',  t.attempts,
          'hintsUsed', t.hints_used,
          'won',       t.won
        ) ORDER BY t.rank
      ) FROM top t),
      '[]'::jsonb
    )
  );
$$;

REVOKE ALL ON FUNCTION public.daily_puzzle_leaderboard(date, int, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.daily_puzzle_leaderboard(date, int, text)
  TO service_role;

-- ---------------------------------------------------------------------------
-- daily_puzzle_leaderboard_me — per-user view, per difficulty.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.daily_puzzle_leaderboard_me(date, text, int);

CREATE OR REPLACE FUNCTION public.daily_puzzle_leaderboard_me(
  p_date       date,
  p_user_id    text,
  p_neighbors  int DEFAULT 2,
  p_difficulty text DEFAULT 'easy'
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT
      a.user_id,
      a.attempts,
      a.hints_used,
      a.won,
      a.created_at,
      ROW_NUMBER() OVER (
        ORDER BY
          a.won DESC,
          CASE WHEN a.won THEN a.attempts   END ASC NULLS LAST,
          CASE WHEN a.won THEN a.hints_used END ASC NULLS LAST,
          a.created_at ASC
      )::int AS rank
    FROM daily_game_attempts a
    WHERE a.date = p_date
      AND a.difficulty = p_difficulty
  ),
  my_rank AS (
    SELECT rank FROM ranked WHERE user_id = p_user_id LIMIT 1
  ),
  neighbors AS (
    SELECT r.*, u.username, u.first_name, u.last_name, u.image_url
    FROM ranked r
    LEFT JOIN users u ON u.id = r.user_id AND u.is_deleted = false
    WHERE EXISTS (SELECT 1 FROM my_rank)
      AND r.rank BETWEEN
        GREATEST(1, (SELECT rank FROM my_rank) - GREATEST(0, p_neighbors))
        AND (SELECT rank FROM my_rank) + GREATEST(0, p_neighbors)
    ORDER BY r.rank
  ),
  -- Streak window mirrors `user_game_stats` — same difficulty filter so a
  -- hard-mode streak badge on the leaderboard row reflects hard-mode wins.
  won_days AS (
    SELECT
      date,
      date - (ROW_NUMBER() OVER (ORDER BY date))::int AS grp
    FROM daily_game_attempts
    WHERE user_id = p_user_id
      AND difficulty = p_difficulty
      AND won
  ),
  streak_groups AS (
    SELECT COUNT(*) AS streak_len, MAX(date) AS streak_end
    FROM won_days
    GROUP BY grp
  ),
  current_streak AS (
    SELECT streak_len
    FROM streak_groups
    WHERE streak_end >= (now() AT TIME ZONE 'UTC')::date - INTERVAL '1 day'
    ORDER BY streak_end DESC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'date',          p_date,
    'difficulty',    p_difficulty,
    'totalPlayers',  (SELECT COUNT(*) FROM ranked),
    'rank',          (SELECT rank FROM my_rank),
    'played',        EXISTS (SELECT 1 FROM my_rank),
    'currentStreak', COALESCE((SELECT streak_len FROM current_streak), 0),
    'neighbors', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'rank',      n.rank,
          'userId',    n.user_id,
          'username',  n.username,
          'firstName', n.first_name,
          'lastName',  n.last_name,
          'imageUrl',  n.image_url,
          'attempts',  n.attempts,
          'hintsUsed', n.hints_used,
          'won',       n.won
        ) ORDER BY n.rank
      ) FROM neighbors n),
      '[]'::jsonb
    )
  );
$$;

REVOKE ALL ON FUNCTION public.daily_puzzle_leaderboard_me(date, text, int, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.daily_puzzle_leaderboard_me(date, text, int, text)
  TO service_role;

-- ---------------------------------------------------------------------------
-- admin_daily_puzzle_stats — admin detail view, per difficulty.
--
-- The admin sheet that opens from the calendar already passes a date; we
-- add `p_difficulty` so admins can compare easy vs. hard performance on
-- the same day.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.admin_daily_puzzle_stats(date);

CREATE OR REPLACE FUNCTION public.admin_daily_puzzle_stats(
  p_date       date,
  p_difficulty text DEFAULT 'easy'
)
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
      COALESCE(guesses, '[]'::jsonb) AS guesses
    FROM daily_game_attempts
    WHERE date = p_date
      AND difficulty = p_difficulty
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

REVOKE ALL ON FUNCTION public.admin_daily_puzzle_stats(date, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_daily_puzzle_stats(date, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.admin_daily_puzzle_stats(date, text) IS
  'Aggregated stats for a single daily puzzle, scoped to one difficulty.';
