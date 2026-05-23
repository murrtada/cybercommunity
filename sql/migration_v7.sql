-- Run in Supabase SQL Editor
-- v7: Notifications, Admin, Site Config, Featured Video

-- 1. Site config (key-value for featured video, etc.)
CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO site_config (key, value) VALUES ('featured_video_id', '')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read site_config" ON site_config;
CREATE POLICY "Anyone can read site_config"
  ON site_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can update site_config" ON site_config;
CREATE POLICY "Admins can update site_config"
  ON site_config FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 2. Admin role on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- 3. Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'reply', 'new_post', 'new_writeup')),
  title TEXT NOT NULL DEFAULT '',
  message TEXT DEFAULT '',
  content_type TEXT DEFAULT NULL,
  content_id UUID DEFAULT NULL,
  content_slug TEXT DEFAULT NULL,
  actor_id UUID REFERENCES profiles(id) ON DELETE CASCADE DEFAULT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications(user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE USING (auth.uid() = user_id);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

-- 4. Notification trigger functions

-- Like notification
CREATE OR REPLACE FUNCTION handle_like_notification()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  content_author_id UUID;
  content_title TEXT;
  content_slug_val TEXT;
BEGIN
  IF NEW.content_type = 'post' THEN
    SELECT author_id, COALESCE(title, 'A post'), slug INTO content_author_id, content_title, content_slug_val
    FROM posts WHERE id = NEW.content_id;
  ELSE
    SELECT author_id, COALESCE(title, 'A writeup'), slug INTO content_author_id, content_title, content_slug_val
    FROM writeups WHERE id = NEW.content_id;
  END IF;

  IF content_author_id IS NOT NULL AND content_author_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, title, message, content_type, content_id, content_slug, actor_id)
    VALUES (content_author_id, 'like', content_title, 'liked your content', NEW.content_type, NEW.content_id, content_slug_val, NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_like_insert ON likes;
CREATE TRIGGER on_like_insert
  AFTER INSERT ON likes
  FOR EACH ROW EXECUTE FUNCTION handle_like_notification();

-- Comment notification
CREATE OR REPLACE FUNCTION handle_comment_notification()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  content_author_id UUID;
  content_title TEXT;
  content_slug_val TEXT;
  comment_preview TEXT;
BEGIN
  comment_preview := LEFT(NEW.body, 100);

  IF NEW.content_type = 'post' THEN
    SELECT author_id, COALESCE(title, 'A post'), slug INTO content_author_id, content_title, content_slug_val
    FROM posts WHERE id = NEW.content_id;
  ELSE
    SELECT author_id, COALESCE(title, 'A writeup'), slug INTO content_author_id, content_title, content_slug_val
    FROM writeups WHERE id = NEW.content_id;
  END IF;

  IF content_author_id IS NOT NULL AND content_author_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, title, message, content_type, content_id, content_slug, actor_id)
    VALUES (content_author_id, 'comment', content_title, comment_preview, NEW.content_type, NEW.content_id, content_slug_val, NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_insert ON comments;
CREATE TRIGGER on_comment_insert
  AFTER INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION handle_comment_notification();

-- Reply notification (when comment has parent_id, notify parent comment author)
CREATE OR REPLACE FUNCTION handle_reply_notification()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  parent_author_id UUID;
  content_title TEXT;
  content_slug_val TEXT;
  comment_preview TEXT;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO parent_author_id FROM comments WHERE id = NEW.parent_id;

    IF NEW.content_type = 'post' THEN
      SELECT title, slug INTO content_title, content_slug_val FROM posts WHERE id = NEW.content_id;
    ELSE
      SELECT title, slug INTO content_title, content_slug_val FROM writeups WHERE id = NEW.content_id;
    END IF;

    comment_preview := LEFT(NEW.body, 100);

    IF parent_author_id IS NOT NULL AND parent_author_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, type, title, message, content_type, content_id, content_slug, actor_id)
      VALUES (parent_author_id, 'reply', COALESCE(content_title, 'A comment'), comment_preview, NEW.content_type, NEW.content_id, content_slug_val, NEW.user_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_reply ON comments;
CREATE TRIGGER on_comment_reply
  AFTER INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION handle_reply_notification();

-- 5. Admin override RLS policies

-- Admin can view any content (including drafts)
DROP POLICY IF EXISTS "Admins can view any content" ON posts;
CREATE POLICY "Admins can view any content"
  ON posts FOR SELECT USING (
    published = true OR auth.uid() = author_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "Admins can view any writeup" ON writeups;
CREATE POLICY "Admins can view any writeup"
  ON writeups FOR SELECT USING (
    published = true OR auth.uid() = author_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
-- Allow admins to delete any content

DROP POLICY IF EXISTS "Authors or admins can delete posts" ON posts;
CREATE POLICY "Authors or admins can delete posts"
  ON posts FOR DELETE USING (
    auth.uid() = author_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "Authors or admins can update posts" ON posts;
CREATE POLICY "Authors or admins can update posts"
  ON posts FOR UPDATE USING (
    auth.uid() = author_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "Authors or admins can delete writeups" ON writeups;
CREATE POLICY "Authors or admins can delete writeups"
  ON writeups FOR DELETE USING (
    auth.uid() = author_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "Authors or admins can update writeups" ON writeups;
CREATE POLICY "Authors or admins can update writeups"
  ON writeups FOR UPDATE USING (
    auth.uid() = author_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "Users or admins can delete comments" ON comments;
CREATE POLICY "Users or admins can delete comments"
  ON comments FOR DELETE USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "Users or admins can delete videos" ON videos;
CREATE POLICY "Users or admins can delete videos"
  ON videos FOR DELETE USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 6. Admin view all users (need a secure way to list users)
-- Create a view that exposes only safe user info
CREATE OR REPLACE VIEW public.user_profiles AS
SELECT
  p.id,
  p.username,
  p.full_name,
  p.avatar_url,
  p.bio,
  p.created_at,
  p.is_admin,
  (SELECT COUNT(*) FROM posts WHERE author_id = p.id) AS post_count,
  (SELECT COUNT(*) FROM writeups WHERE author_id = p.id) AS writeup_count
FROM profiles p;

-- Admin can see user_profiles
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "Triggers can insert notifications" ON notifications;
CREATE POLICY "Triggers can insert notifications"
  ON notifications FOR INSERT WITH CHECK (true);
