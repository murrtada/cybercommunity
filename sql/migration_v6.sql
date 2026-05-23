-- Run in Supabase SQL Editor
-- Professional comments + likes overhaul with threaded replies, realtime, indexes

-- 1. Drop old tables if re-running (safe for dev; comment out for production)
-- DROP TABLE IF EXISTS comments CASCADE;
-- DROP TABLE IF EXISTS likes CASCADE;

-- 2. Create likes table (if not exists)
CREATE TABLE IF NOT EXISTS likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'writeup')),
  content_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, content_type, content_id)
);

-- 3. Create comments table with parent_id for threaded replies
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'writeup')),
  content_id UUID NOT NULL,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_comments_content ON comments(content_type, content_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_likes_content ON likes(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);

-- 5. RLS
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- 6. Likes policies
DROP POLICY IF EXISTS "Anyone can read likes" ON likes;
DROP POLICY IF EXISTS "Auth users can insert likes" ON likes;
DROP POLICY IF EXISTS "Users can delete own likes" ON likes;
CREATE POLICY "Anyone can read likes" ON likes FOR SELECT USING (true);
CREATE POLICY "Auth users can insert likes" ON likes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can delete own likes" ON likes FOR DELETE USING (auth.uid() = user_id);

-- 7. Comments policies
DROP POLICY IF EXISTS "Anyone can read comments" ON comments;
DROP POLICY IF EXISTS "Auth users can insert comments" ON comments;
DROP POLICY IF EXISTS "Users can update own comments" ON comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON comments;
CREATE POLICY "Anyone can read comments" ON comments FOR SELECT USING (true);
CREATE POLICY "Auth users can insert comments" ON comments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update own comments" ON comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON comments FOR DELETE USING (auth.uid() = user_id);

-- 8. Enable Realtime for comments and likes
-- This allows live updates when new comments are added
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE likes;

-- 9. Function to get likers for tooltip
CREATE OR REPLACE FUNCTION get_likers(content_type TEXT, content_id UUID, limit_to INT DEFAULT 3)
RETURNS TABLE(username TEXT, avatar_url TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT p.username, p.avatar_url
  FROM likes l
  JOIN profiles p ON p.id = l.user_id
  WHERE l.content_type = get_likers.content_type AND l.content_id = get_likers.content_id
  ORDER BY l.created_at DESC
  LIMIT limit_to;
END;
$$;
