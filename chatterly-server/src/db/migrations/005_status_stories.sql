CREATE TABLE IF NOT EXISTS statuses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caption     text,
  bg_color    text NOT NULL DEFAULT '#0E8A7D',
  media_id    uuid REFERENCES media(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX IF NOT EXISTS idx_statuses_expires ON statuses(expires_at DESC);

CREATE TABLE IF NOT EXISTS status_views (
  status_id  uuid NOT NULL REFERENCES statuses(id) ON DELETE CASCADE,
  viewer_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (status_id, viewer_id)
);
