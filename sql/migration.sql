-- Run this in Supabase SQL Editor
-- Go to: https://supabase.com → your project → SQL Editor → New Query

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  linkedin_url TEXT DEFAULT '',
  github_url TEXT DEFAULT '',
  twitter_url TEXT DEFAULT '',
  facebook_url TEXT DEFAULT '',
  website_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  excerpt TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  cover_image TEXT DEFAULT '',
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE writeups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  excerpt TEXT DEFAULT '',
  ctf_name TEXT DEFAULT '',
  challenge_name TEXT DEFAULT '',
  category TEXT DEFAULT '',
  difficulty TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  cover_image TEXT DEFAULT '',
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  youtube_id TEXT NOT NULL,
  title TEXT DEFAULT '',
  url TEXT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE writeups ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Published posts are public"
  ON posts FOR SELECT USING (published = true);

CREATE POLICY "Authors can view own posts"
  ON posts FOR SELECT USING (auth.uid() = author_id);

CREATE POLICY "Authors can insert posts"
  ON posts FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update own posts"
  ON posts FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete own posts"
  ON posts FOR DELETE USING (auth.uid() = author_id);

CREATE POLICY "Published writeups are public"
  ON writeups FOR SELECT USING (published = true);

CREATE POLICY "Authors can view own writeups"
  ON writeups FOR SELECT USING (auth.uid() = author_id);

CREATE POLICY "Authors can insert writeups"
  ON writeups FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update own writeups"
  ON writeups FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete own writeups"
  ON writeups FOR DELETE USING (auth.uid() = author_id);

CREATE POLICY "Videos are viewable by everyone"
  ON videos FOR SELECT USING (true);

CREATE POLICY "Users can insert own videos"
  ON videos FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own videos"
  ON videos FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own videos"
  ON videos FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
