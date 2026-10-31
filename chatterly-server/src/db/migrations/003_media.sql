CREATE TABLE IF NOT EXISTS media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind varchar(16) NOT NULL, -- 'image', 'audio', 'document'
  storage_key text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  file_name text NOT NULL,
  width int,
  height int,
  duration_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_id uuid REFERENCES media(id) ON DELETE SET NULL;
