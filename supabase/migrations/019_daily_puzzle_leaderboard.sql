-- Migration 019: Daily-puzzle leaderboard (simplification of 015 + 018)
--
-- Replaces the all-time, multi-sort, multi-window leaderboard with a
-- single daily ranking. Inspired by the LinkedIn Games leaderboard:
-- players overwhelmingly want to know "how did I do on today's puzzle
-- vs everyone else", not "who has the highest all-time win rate". One
-- metric, one ordering, one day.
--
-- Daily score (lower rank = better):
--   1. Winners come before losers (won DESC).
--   2. Among winners: fewer attempts, then fewer hints, then earlier
--      submission. Hints break the attempts tie because a 2/4 with no
--      hints really is better than a 2/4 with three hints.
--   3. Among losers: ordered by submission time only — losing in 4/4
--      with 0 hints isn't meaningfully "better" than 4/4 with 1 hint,
--      and over-ranking partial losses just adds noise.
--
-- Drops the leaderboard RPCs from migrations 015 and 018; they're no
-- longer wired into the API. `user_game_stats` is kept untouched —
-- the game page still uses it for the per-user stats sidebar.

-- Drop the RPCs introduced in 015 and 018. CASCADE is unnecessary —
-- nothing else in the schema depends on these functions, only the
-- application code did, and that code has moved to the new RPCs.
DROP FUNCTION IF EXISTS public.leaderboard_stats(text, int);
DROP FUNCTION IF EXISTS public.leaderboard_stats(text, int, text, int);
DROP FUNCTION IF EXISTS public.user_leaderboard_rank(text, text, text, int);

-- ---------------------------------------------------------------------------
-- daily_puzzle_leaderboard(p_date, p_limit)
--
-- Top-N rows for a single UTC date, with rank. Public + edge-cacheable
-- (the response only contains user_id + display fields + the day's score).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.daily_puzzle_leaderboard(
  p_date  date,
  p_limit int DEFAULT 10
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

REVOKE ALL ON FUNCTION public.daily_puzzle_leaderboard(date, int)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.daily_puzzle_leaderboard(date, int)
  TO service_role;


-- ---------------------------------------------------------------------------
-- daily_puzzle_leaderboard_me(p_date, p_user_id, p_neighbors)
--
-- Per-user view of the same ranking: caller's row plus N neighbors above
-- and N below, with their current all-time streak rolled in for the
-- streak badge. NOT edge-cacheable — the route serves it with
-- `Cache-Control: private, no-store`.
--
-- If the caller hasn't played today, `played` is false and `neighbors`
-- is empty. The UI can fall back to the public top-N in that case.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.daily_puzzle_leaderboard_me(
  p_date      date,
  p_user_id   text,
  p_neighbors int DEFAULT 2
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
  -- Classic gaps-and-islands streak: subtract row-number-as-day from
  -- the win date so consecutive wins land in the same group. Same shape
  -- as user_game_stats — kept inline so the route only needs one RPC.
  won_days AS (
    SELECT
      date,
      date - (ROW_NUMBER() OVER (ORDER BY date))::int AS grp
    FROM daily_game_attempts
    WHERE user_id = p_user_id AND won
  ),
  streak_groups AS (
    SELECT COUNT(*) AS streak_len, MAX(date) AS streak_end
    FROM won_days
    GROUP BY grp
  ),
  current_streak AS (
    -- 2-day grace window: if you haven't played "today" yet but won
    -- yesterday, the streak still counts until midnight UTC flips again.
    SELECT streak_len
    FROM streak_groups
    WHERE streak_end >= (now() AT TIME ZONE 'UTC')::date - INTERVAL '1 day'
    ORDER BY streak_end DESC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'date',          p_date,
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

REVOKE ALL ON FUNCTION public.daily_puzzle_leaderboard_me(date, text, int)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.daily_puzzle_leaderboard_me(date, text, int)
  TO service_role;
