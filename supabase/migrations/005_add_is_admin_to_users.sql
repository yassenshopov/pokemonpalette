-- Add is_admin column to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false NOT NULL;

-- Create index for better performance on admin queries
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON public.users(is_admin);

COMMENT ON COLUMN public.users.is_admin IS 'Whether the user has admin privileges';

