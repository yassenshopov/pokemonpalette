-- Leaderboard indexes.
--
-- The leaderboard endpoint aggregates per-user stats across the entire
-- daily_game_attempts table. The existing single-column indexes
-- (user_id, date, won, created_at) help individual lookups but a compound
-- (user_id, date DESC) lets Postgres serve per-user streak + history
-- queries from the index alone, which is the hot path when a signed-in
-- user opens the result dialog or leaderboard tab.
--
-- The partial index on won = true supports win-rate / total-wins sorts
-- without scanning losses.

CREATE INDEX IF NOT EXISTS idx_daily_game_attempts_user_date_desc
    ON public.daily_game_attempts (user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_game_attempts_won_true
    ON public.daily_game_attempts (user_id)
    WHERE won = true;
