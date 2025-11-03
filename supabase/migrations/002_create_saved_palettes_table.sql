-- Create saved_palettes table for storing user's saved Pokemon palettes
CREATE TABLE IF NOT EXISTS public.saved_palettes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    pokemon_id INTEGER NOT NULL,
    pokemon_name TEXT NOT NULL,
    pokemon_form TEXT,
    is_shiny BOOLEAN DEFAULT false NOT NULL,
    colors JSONB NOT NULL, -- Array of color hex values
    image_url TEXT, -- URL to the Pokemon image used
    palette_name TEXT, -- Optional custom name for the palette
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_saved_palettes_user_id ON public.saved_palettes(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_palettes_pokemon_id ON public.saved_palettes(pokemon_id);
CREATE INDEX IF NOT EXISTS idx_saved_palettes_created_at ON public.saved_palettes(created_at);
CREATE INDEX IF NOT EXISTS idx_saved_palettes_pokemon_name ON public.saved_palettes(pokemon_name);

-- Enable Row Level Security (RLS)
ALTER TABLE public.saved_palettes ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS
-- Allow users to view their own saved palettes
CREATE POLICY "Users can view own saved palettes" ON public.saved_palettes
    FOR SELECT USING (auth.uid()::text = user_id);

-- Allow users to insert their own saved palettes
CREATE POLICY "Users can insert own saved palettes" ON public.saved_palettes
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Allow users to update their own saved palettes
CREATE POLICY "Users can update own saved palettes" ON public.saved_palettes
    FOR UPDATE USING (auth.uid()::text = user_id);

-- Allow users to delete their own saved palettes
CREATE POLICY "Users can delete own saved palettes" ON public.saved_palettes
    FOR DELETE USING (auth.uid()::text = user_id);

-- Allow service role to do everything (for admin operations)
CREATE POLICY "Service role can manage all saved palettes" ON public.saved_palettes
    FOR ALL USING (auth.role() = 'service_role');

-- Create updated_at trigger for saved_palettes
CREATE TRIGGER handle_saved_palettes_updated_at
    BEFORE UPDATE ON public.saved_palettes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
