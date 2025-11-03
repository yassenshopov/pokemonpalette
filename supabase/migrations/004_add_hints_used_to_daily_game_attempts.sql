-- Add hints_used column to daily_game_attempts table
ALTER TABLE public.daily_game_attempts
ADD COLUMN IF NOT EXISTS hints_used INTEGER DEFAULT 0 NOT NULL;

COMMENT ON COLUMN public.daily_game_attempts.hints_used IS 'Number of hints used during the game attempt (0-3)';

