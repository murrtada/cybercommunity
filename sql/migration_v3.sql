-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS contact_inquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT DEFAULT '',
  service TEXT DEFAULT '',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contact_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert inquiries"
  ON contact_inquiries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Only authenticated users can view inquiries"
  ON contact_inquiries FOR SELECT
  USING (auth.role() = 'authenticated');
