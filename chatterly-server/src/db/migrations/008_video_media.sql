ALTER TABLE media DROP CONSTRAINT IF EXISTS media_kind_check;
ALTER TABLE media ADD CONSTRAINT media_kind_check
  CHECK (kind IN ('image', 'video', 'audio', 'document'));
