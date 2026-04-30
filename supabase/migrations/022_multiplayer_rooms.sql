-- Multiplayer rooms and participants for head-to-head gameplay.
--
-- Flow: Player 1 creates a room (status='waiting'), gets a 6-char code.
-- Player 2 joins with that code. Both race to guess the same Pokemon.
-- Supabase Realtime channels handle live state sync between clients.

-- -----------------------------------------------------------------------
-- 1. Create both tables first (no RLS policies yet)
-- -----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.multiplayer_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code VARCHAR(6) UNIQUE NOT NULL,
    host_user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    target_pokemon_id INTEGER NOT NULL,
    is_shiny BOOLEAN DEFAULT false NOT NULL,
    status VARCHAR(20) DEFAULT 'waiting' NOT NULL
        CHECK (status IN ('waiting', 'playing', 'finished')),
    winner_user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mp_rooms_room_code ON public.multiplayer_rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_mp_rooms_host_user_id ON public.multiplayer_rooms(host_user_id);
CREATE INDEX IF NOT EXISTS idx_mp_rooms_status ON public.multiplayer_rooms(status);
CREATE INDEX IF NOT EXISTS idx_mp_rooms_expires_at ON public.multiplayer_rooms(expires_at);

CREATE TABLE IF NOT EXISTS public.multiplayer_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.multiplayer_rooms(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    username TEXT,
    image_url TEXT,
    guesses JSONB DEFAULT '[]'::jsonb NOT NULL,
    attempts INTEGER DEFAULT 0 NOT NULL,
    won BOOLEAN DEFAULT false NOT NULL,
    best_similarity FLOAT DEFAULT 0 NOT NULL,
    hints_used INTEGER DEFAULT 0 NOT NULL,
    finished_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_mp_players_room_id ON public.multiplayer_players(room_id);
CREATE INDEX IF NOT EXISTS idx_mp_players_user_id ON public.multiplayer_players(user_id);

-- -----------------------------------------------------------------------
-- 2. Enable RLS on both tables (now that both exist, cross-table
--    subqueries in policies will resolve correctly)
-- -----------------------------------------------------------------------

ALTER TABLE public.multiplayer_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view rooms they participate in" ON public.multiplayer_rooms
    FOR SELECT USING (
        host_user_id = auth.uid()::text
        OR id IN (SELECT room_id FROM public.multiplayer_players WHERE user_id = auth.uid()::text)
    );

CREATE POLICY "Authenticated users can create rooms" ON public.multiplayer_rooms
    FOR INSERT WITH CHECK (host_user_id = auth.uid()::text);

CREATE POLICY "Service role can manage all rooms" ON public.multiplayer_rooms
    FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.multiplayer_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view players in their rooms" ON public.multiplayer_players
    FOR SELECT USING (
        user_id = auth.uid()::text
        OR room_id IN (SELECT id FROM public.multiplayer_rooms WHERE host_user_id = auth.uid()::text)
        OR room_id IN (SELECT room_id FROM public.multiplayer_players p WHERE p.user_id = auth.uid()::text)
    );

CREATE POLICY "Users can insert themselves as players" ON public.multiplayer_players
    FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own player record" ON public.multiplayer_players
    FOR UPDATE USING (user_id = auth.uid()::text);

CREATE POLICY "Service role can manage all players" ON public.multiplayer_players
    FOR ALL USING (auth.role() = 'service_role');

-- -----------------------------------------------------------------------
-- 3. Enable Supabase Realtime on multiplayer tables
-- -----------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE public.multiplayer_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.multiplayer_players;
