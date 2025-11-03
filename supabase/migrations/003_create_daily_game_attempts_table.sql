-- Create daily_game_attempts table for tracking daily game progress
CREATE TABLE IF NOT EXISTS public.daily_game_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL, -- The game date (not when they played)
    target_pokemon_id INTEGER NOT NULL,
    is_shiny BOOLEAN DEFAULT false NOT NULL,
    guesses JSONB NOT NULL, -- Array of Pokemon IDs guessed
    attempts INTEGER NOT NULL, -- Number of attempts made (1-4)
    won BOOLEAN DEFAULT false NOT NULL, -- Did they guess correctly?
    pokemon_guessed INTEGER, -- The Pokemon ID they guessed (if won)
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, date) -- One attempt per user per day
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_daily_game_attempts_user_id ON public.daily_game_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_game_attempts_date ON public.daily_game_attempts(date);
CREATE INDEX IF NOT EXISTS idx_daily_game_attempts_won ON public.daily_game_attempts(won);
CREATE INDEX IF NOT EXISTS idx_daily_game_attempts_created_at ON public.daily_game_attempts(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.daily_game_attempts ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS
-- Allow users to view their own game attempts
CREATE POLICY "Users can view own game attempts" ON public.daily_game_attempts
    FOR SELECT USING (auth.uid()::text = user_id);

-- Allow users to insert their own game attempts
CREATE POLICY "Users can insert own game attempts" ON public.daily_game_attempts
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Allow users to update their own game attempts
CREATE POLICY "Users can update own game attempts" ON public.daily_game_attempts
    FOR UPDATE USING (auth.uid()::text = user_id);

-- Allow service role to do everything (for admin operations)
CREATE POLICY "Service role can manage all game attempts" ON public.daily_game_attempts
    FOR ALL USING (auth.role() = 'service_role');

-- Create updated_at trigger for daily_game_attempts
CREATE TRIGGER handle_daily_game_attempts_updated_at
    BEFORE UPDATE ON public.daily_game_attempts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

