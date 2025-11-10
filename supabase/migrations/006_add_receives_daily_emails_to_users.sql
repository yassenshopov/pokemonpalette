-- Add receives_daily_emails column to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS receives_daily_emails BOOLEAN DEFAULT true NOT NULL;

-- Create index for better performance on email preference queries
CREATE INDEX IF NOT EXISTS idx_users_receives_daily_emails ON public.users(receives_daily_emails);

COMMENT ON COLUMN public.users.receives_daily_emails IS 'Whether the user wants to receive daily nudge emails';

