-- Migration 015: SQL-side aggregation for leaderboard + per-user stats
--
-- Replaces the O(n) in-Node aggregation that previously ran in
-- src/app/api/daily-game-attempts/leaderboard/route.ts. Streaks are
-- computed with the standard gaps-and-islands pattern and filter on
-- `won = true` (the JS version counted any play). All date math is in
-- UTC — matches the client seed in src/lib/game/similarity.ts.

-- ---------------------------------------------------------------------------
-- Helper: attempts-rows-with-island-group
--
-- For every winning row, compute a grouping key such that consecutive UTC
-- days on which the user won share the same key. Then COUNT(*) over each
-- group = streak length.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- leaderboard_stats(p_sort_by, p_limit)
-- Returns the top-N users by the requested sort, with names.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.leaderboard_stats(
  p_sort_by text DEFAULT 'currentStreak',
  p_limit   int  DEFAULT 10
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH per_user AS (
    SELECT
      user_id,
      COUNT(*)                                  AS total_games,
      COUNT(*) FILTER (WHERE won)               AS total_wins,
      COUNT(*) FILTER (WHERE won) * 100.0
        / NULLIF(COUNT(*), 0)                   AS win_rate,
      AVG(attempts)::numeric                    AS avg_attempts
    FROM daily_game_attempts
    GROUP BY user_id
  ),
  won_days AS (
    SELECT
      user_id,
      date,
      -- Classic gaps-and-islands: subtract row number (as day offset) from
      -- the date; consecutive dates land in the same island.
      date - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY date))::int AS grp
    FROM daily_game_attempts
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
    -- Two-day grace lets users who haven't played "today" yet keep their
    -- streak until the day flips.
    SELECT user_id, streak_len AS current_streak
    FROM streaks
    WHERE streak_end >= (now() AT TIME ZONE 'UTC')::date - INTERVAL '1 day'
  ),
  combined AS (
    SELECT
      pu.user_id,
      pu.total_games,
      pu.total_wins,
      ROUND(COALESCE(pu.win_rate, 0)::numeric,   2) AS win_rate,
      ROUND(COALESCE(pu.avg_attempts, 0),        2) AS average_attempts,
      COALESCE(cpu.current_streak, 0)                AS current_streak,
      COALESCE(lpu.longest_streak, 0)                AS longest_streak
    FROM per_user pu
    LEFT JOIN longest_per_user lpu ON lpu.user_id = pu.user_id
    LEFT JOIN current_per_user cpu ON cpu.user_id = pu.user_id
  ),
  sorted AS (
    SELECT
      c.*,
      u.username,
      u.first_name,
      u.last_name,
      u.image_url
    FROM combined c
    LEFT JOIN users u ON u.id = c.user_id AND u.is_deleted = false
    ORDER BY
      CASE WHEN p_sort_by = 'currentStreak'    THEN c.current_streak   END DESC NULLS LAST,
      CASE WHEN p_sort_by = 'winRate'          THEN c.win_rate         END DESC NULLS LAST,
      CASE WHEN p_sort_by = 'totalWins'        THEN c.total_wins       END DESC NULLS LAST,
      CASE WHEN p_sort_by = 'averageAttempts'  THEN c.average_attempts END ASC  NULLS LAST,
      -- Secondary sort tie-breakers match the old JS behaviour.
      c.win_rate   DESC NULLS LAST,
      c.total_wins DESC NULLS LAST
    LIMIT GREATEST(1, LEAST(100, p_limit))
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
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
    ),
    '[]'::jsonb
  )
  FROM sorted s;
$$;

REVOKE ALL ON FUNCTION public.leaderboard_stats(text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard_stats(text, int) TO service_role;

-- ---------------------------------------------------------------------------
-- user_game_stats(p_user_id)
-- One-user version of the aggregate, used by GET /api/daily-game-attempts
-- with ?stats=true. Returns totals + streaks without touching the full
-- table.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_game_stats(p_user_id text)
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
  ),
  won_days AS (
    SELECT
      date,
      date - (ROW_NUMBER() OVER (ORDER BY date))::int AS grp
    FROM daily_game_attempts
    WHERE user_id = p_user_id AND won
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

REVOKE ALL ON FUNCTION public.user_game_stats(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_game_stats(text) TO service_role;
