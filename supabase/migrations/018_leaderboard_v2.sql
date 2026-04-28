-- Migration 018: Leaderboard v2 — time windows, min-games threshold, per-user rank
--
-- Supersedes the function added in migration 015. Adds:
--   * p_window  ('all' | 'week' | 'today') — filters attempts by UTC date range
--   * p_min_games (int)                    — when sorting by winRate, hides
--                                            low-volume users so 1-of-1 = 100%
--                                            doesn't dominate the board
--   * `rank` field returned inline         — client no longer has to recount
--
-- Adds user_leaderboard_rank() so /api/daily-game-attempts/leaderboard/me
-- can pin the caller's row below the top-N when they're not visible. That
-- endpoint is per-user and NOT edge-cacheable — keep it that way.

-- Old (text, int) signature is replaced. CREATE OR REPLACE can't change a
-- function's signature in Postgres, so drop and recreate.
DROP FUNCTION IF EXISTS public.leaderboard_stats(text, int);

CREATE OR REPLACE FUNCTION public.leaderboard_stats(
  p_sort_by    text DEFAULT 'currentStreak',
  p_limit      int  DEFAULT 10,
  p_window     text DEFAULT 'all',
  p_min_games  int  DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  -- Date floor for the time window. NULL = no filter (all-time).
  -- 'week' is the trailing 7 UTC days inclusive of today.
  win AS (
    SELECT CASE
      WHEN p_window = 'today' THEN (now() AT TIME ZONE 'UTC')::date
      WHEN p_window = 'week'  THEN (now() AT TIME ZONE 'UTC')::date - INTERVAL '6 days'
      ELSE NULL
    END::date AS floor_date
  ),
  filtered AS (
    SELECT a.*
    FROM daily_game_attempts a, win w
    WHERE w.floor_date IS NULL OR a.date >= w.floor_date
  ),
  per_user AS (
    SELECT
      user_id,
      COUNT(*)                                  AS total_games,
      COUNT(*) FILTER (WHERE won)               AS total_wins,
      COUNT(*) FILTER (WHERE won) * 100.0
        / NULLIF(COUNT(*), 0)                   AS win_rate,
      AVG(attempts)::numeric                    AS avg_attempts
    FROM filtered
    GROUP BY user_id
  ),
  won_days AS (
    SELECT
      user_id,
      date,
      date - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY date))::int AS grp
    FROM filtered
    WHERE won
  ),
  streaks AS (
    SELECT
      user_id,
      COUNT(*)   AS streak_len,
      MAX(date)  AS streak_end
    FROM won_days
    GROUP BY user_id, grp
  ),
  longest_per_user AS (
    SELECT user_id, MAX(streak_len) AS longest_streak
    FROM streaks
    GROUP BY user_id
  ),
  current_per_user AS (
    -- "Current" = streak whose last win is today-UTC or yesterday-UTC.
    -- MAX() guards against the (theoretically impossible but cheap to
    -- defend) case of multiple rows surviving the cutoff for one user.
    SELECT user_id, MAX(streak_len) AS current_streak
    FROM streaks
    WHERE streak_end >= (now() AT TIME ZONE 'UTC')::date - INTERVAL '1 day'
    GROUP BY user_id
  ),
  combined AS (
    SELECT
      pu.user_id,
      pu.total_games,
      pu.total_wins,
      ROUND(COALESCE(pu.win_rate, 0)::numeric, 2) AS win_rate,
      ROUND(COALESCE(pu.avg_attempts, 0), 2)      AS average_attempts,
      COALESCE(cpu.current_streak, 0)             AS current_streak,
      COALESCE(lpu.longest_streak, 0)             AS longest_streak
    FROM per_user pu
    LEFT JOIN longest_per_user lpu ON lpu.user_id = pu.user_id
    LEFT JOIN current_per_user cpu ON cpu.user_id = pu.user_id
    -- Min-games threshold only applies to win-rate. Other sorts can't be
    -- gamed by a one-and-done player, so the filter would just confuse
    -- newcomers checking the "Total wins" board.
    WHERE p_sort_by <> 'winRate' OR pu.total_games >= GREATEST(0, p_min_games)
  ),
  ranked AS (
    SELECT
      c.*,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE WHEN p_sort_by = 'currentStreak'    THEN c.current_streak   END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'winRate'          THEN c.win_rate         END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'totalWins'        THEN c.total_wins       END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'averageAttempts'  THEN c.average_attempts END ASC  NULLS LAST,
          -- Stable tie-breakers — the JS version had win_rate / total_wins,
          -- adding user_id as final guarantees a deterministic order.
          c.win_rate   DESC NULLS LAST,
          c.total_wins DESC NULLS LAST,
          c.user_id    ASC
      )::int AS rank
    FROM combined c
  ),
  sorted AS (
    SELECT
      r.*,
      u.username,
      u.first_name,
      u.last_name,
      u.image_url
    FROM ranked r
    LEFT JOIN users u ON u.id = r.user_id AND u.is_deleted = false
    ORDER BY r.rank
    LIMIT GREATEST(1, LEAST(100, p_limit))
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'rank',            s.rank,
        'userId',          s.user_id,
        'username',        s.username,
        'firstName',       s.first_name,
        'lastName',        s.last_name,
        'imageUrl',        s.image_url,
        'totalGames',      s.total_games,
        'totalWins',       s.total_wins,
        'winRate',         s.win_rate,
        'currentStreak',   s.current_streak,
        'longestStreak',   s.longest_streak,
        'averageAttempts', s.average_attempts
      )
      ORDER BY s.rank
    ),
    '[]'::jsonb
  )
  FROM sorted s;
$$;

REVOKE ALL ON FUNCTION public.leaderboard_stats(text, int, text, int)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard_stats(text, int, text, int)
  TO service_role;


-- ---------------------------------------------------------------------------
-- user_leaderboard_rank(p_user_id, p_sort_by, p_window, p_min_games)
--
-- Same ordering rules as leaderboard_stats, but returns one user's row plus
-- their rank within the full eligible pool. Used by /leaderboard/me to pin
-- the signed-in player below the top-N when they're not visible. Per-user,
-- so the API route does NOT cache this.
--
-- If the user has no qualifying games (e.g. sorting by winRate with
-- minGames=5 and they've played 2), `rank` is NULL and stats default to 0.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_leaderboard_rank(
  p_user_id    text,
  p_sort_by    text DEFAULT 'currentStreak',
  p_window     text DEFAULT 'all',
  p_min_games  int  DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  win AS (
    SELECT CASE
      WHEN p_window = 'today' THEN (now() AT TIME ZONE 'UTC')::date
      WHEN p_window = 'week'  THEN (now() AT TIME ZONE 'UTC')::date - INTERVAL '6 days'
      ELSE NULL
    END::date AS floor_date
  ),
  filtered AS (
    SELECT a.*
    FROM daily_game_attempts a, win w
    WHERE w.floor_date IS NULL OR a.date >= w.floor_date
  ),
  per_user AS (
    SELECT
      user_id,
      COUNT(*)                                  AS total_games,
      COUNT(*) FILTER (WHERE won)               AS total_wins,
      COUNT(*) FILTER (WHERE won) * 100.0
        / NULLIF(COUNT(*), 0)                   AS win_rate,
      AVG(attempts)::numeric                    AS avg_attempts
    FROM filtered
    GROUP BY user_id
  ),
  won_days AS (
    SELECT
      user_id,
      date,
      date - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY date))::int AS grp
    FROM filtered
    WHERE won
  ),
  streaks AS (
    SELECT user_id, COUNT(*) AS streak_len, MAX(date) AS streak_end
    FROM won_days
    GROUP BY user_id, grp
  ),
  longest_per_user AS (
    SELECT user_id, MAX(streak_len) AS longest_streak
    FROM streaks
    GROUP BY user_id
  ),
  current_per_user AS (
    SELECT user_id, MAX(streak_len) AS current_streak
    FROM streaks
    WHERE streak_end >= (now() AT TIME ZONE 'UTC')::date - INTERVAL '1 day'
    GROUP BY user_id
  ),
  combined AS (
    SELECT
      pu.user_id,
      pu.total_games,
      pu.total_wins,
      ROUND(COALESCE(pu.win_rate, 0)::numeric, 2) AS win_rate,
      ROUND(COALESCE(pu.avg_attempts, 0), 2)      AS average_attempts,
      COALESCE(cpu.current_streak, 0)             AS current_streak,
      COALESCE(lpu.longest_streak, 0)             AS longest_streak
    FROM per_user pu
    LEFT JOIN longest_per_user lpu ON lpu.user_id = pu.user_id
    LEFT JOIN current_per_user cpu ON cpu.user_id = pu.user_id
    WHERE p_sort_by <> 'winRate' OR pu.total_games >= GREATEST(0, p_min_games)
  ),
  ranked AS (
    SELECT
      c.*,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE WHEN p_sort_by = 'currentStreak'    THEN c.current_streak   END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'winRate'          THEN c.win_rate         END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'totalWins'        THEN c.total_wins       END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'averageAttempts'  THEN c.average_attempts END ASC  NULLS LAST,
          c.win_rate   DESC NULLS LAST,
          c.total_wins DESC NULLS LAST,
          c.user_id    ASC
      )::int AS rank,
      (COUNT(*) OVER ())::int AS total_ranked
    FROM combined c
  ),
  me AS (
    SELECT r.*, u.username, u.first_name, u.last_name, u.image_url
    FROM ranked r
    LEFT JOIN users u ON u.id = r.user_id AND u.is_deleted = false
    WHERE r.user_id = p_user_id
  )
  SELECT COALESCE(
    (SELECT jsonb_build_object(
      'rank',            m.rank,
      'totalRanked',     m.total_ranked,
      'userId',          m.user_id,
      'username',        m.username,
      'firstName',       m.first_name,
      'lastName',        m.last_name,
      'imageUrl',        m.image_url,
      'totalGames',      m.total_games,
      'totalWins',       m.total_wins,
      'winRate',         m.win_rate,
      'currentStreak',   m.current_streak,
      'longestStreak',   m.longest_streak,
      'averageAttempts', m.average_attempts
    ) FROM me m),
    -- User has no qualifying games in this (window, minGames) slice.
    jsonb_build_object(
      'rank',            NULL,
      'totalRanked',     (SELECT COUNT(*) FROM combined),
      'userId',          p_user_id,
      'username',        NULL,
      'firstName',       NULL,
      'lastName',        NULL,
      'imageUrl',        NULL,
      'totalGames',      0,
      'totalWins',       0,
      'winRate',         0,
      'currentStreak',   0,
      'longestStreak',   0,
      'averageAttempts', 0
    )
  );
$$;

REVOKE ALL ON FUNCTION public.user_leaderboard_rank(text, text, text, int)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_leaderboard_rank(text, text, text, int)
  TO service_role;
