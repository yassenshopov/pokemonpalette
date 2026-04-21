-- Migration 016: prune redundant indexes on daily_game_attempts.
--
-- Migrations 003, 009, and 010 each added indexes on the same table. Several
-- are strict prefixes of later, more useful composite indexes. Postgres can
-- walk an index in either direction, so ASC-only indexes are also redundant
-- with DESC variants. Dropping duplicates reduces write amplification (every
-- INSERT/UPDATE had to maintain all of them) and saves a few hundred MB of
-- disk as the table grows.

-- (user_id) is a prefix of (user_id, date DESC) — drop.
DROP INDEX IF EXISTS public.idx_daily_game_attempts_user_id;

-- (date) is a prefix of (date DESC, target_pokemon_id) — drop.
DROP INDEX IF EXISTS public.idx_daily_game_attempts_date;

-- (won) is very low cardinality (2 values). Scans are always faster than
-- using this index. The partial idx_daily_game_attempts_won_true covers
-- the useful case.
DROP INDEX IF EXISTS public.idx_daily_game_attempts_won;

-- (created_at) redundant with (created_at DESC) — Postgres walks either
-- direction. Drop the unsorted copy from migration 003.
DROP INDEX IF EXISTS public.idx_daily_game_attempts_created_at;
