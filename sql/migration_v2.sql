-- Run this in Supabase SQL Editor
-- Adds platform column for generic security writeups

ALTER TABLE writeups ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT '';

-- Optional: drop unused columns (uncomment if you want to remove them)
-- ALTER TABLE writeups DROP COLUMN IF EXISTS ctf_name;
-- ALTER TABLE writeups DROP COLUMN IF EXISTS challenge_name;
-- ALTER TABLE writeups DROP COLUMN IF EXISTS difficulty;
