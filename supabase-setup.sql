-- Create the feedback_comments table
CREATE TABLE feedback_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_name TEXT NOT NULL,
  page_url TEXT NOT NULL,
  selected_text TEXT NOT NULL,
  comment TEXT NOT NULL,
  position JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE
);

-- Create indexes for better performance
CREATE INDEX idx_feedback_page_url ON feedback_comments(page_url);
CREATE INDEX idx_feedback_created_at ON feedback_comments(created_at);
CREATE INDEX idx_feedback_telegram_name ON feedback_comments(telegram_name);

-- Enable Row Level Security
ALTER TABLE feedback_comments ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read comments
CREATE POLICY "Allow public read access" ON feedback_comments
  FOR SELECT USING (true);

-- Create policy to allow authenticated users to insert comments
CREATE POLICY "Allow public insert access" ON feedback_comments
  FOR INSERT WITH CHECK (true);