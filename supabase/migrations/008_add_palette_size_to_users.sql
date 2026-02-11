-- Add palette_size column to users table (number of colours to extract: 3, 4, 5, or 6)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS palette_size INTEGER DEFAULT 3 NOT NULL;

-- Constrain to valid values (3-6)
ALTER TABLE public.users
ADD CONSTRAINT chk_palette_size_range CHECK (palette_size >= 3 AND palette_size <= 6);

COMMENT ON COLUMN public.users.palette_size IS 'Number of colours to show in palette (3, 4, 5, or 6)';
