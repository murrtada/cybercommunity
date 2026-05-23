-- Run in Supabase SQL Editor
-- Fix Storage RLS policies for avatars bucket

DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Auth update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete avatars" ON storage.objects;

CREATE POLICY "Public read avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Auth upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Auth update avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Auth delete avatars"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
