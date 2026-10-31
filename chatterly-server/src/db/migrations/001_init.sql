CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone varchar(32) NOT NULL UNIQUE,
  phone_hash bpchar(64) NOT NULL,
  name varchar(60),
  about varchar(139) NOT NULL DEFAULT 'Hey there! I am using Chatterly',
  avatar_url text,
  last_seen_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_phone_hash ON users(phone_hash);

CREATE TABLE IF NOT EXISTS device_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash bpchar(64) NOT NULL,
  device_id text,
  platform text,
  push_token text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_sessions_user ON device_sessions(user_id);

CREATE TABLE IF NOT EXISTS chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type varchar(16) NOT NULL DEFAULT 'direct', -- 'direct' or 'group'
  direct_key text UNIQUE,
  name text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  last_seq bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_members (
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role varchar(16) NOT NULL DEFAULT 'member', -- 'admin' or 'member'
  last_read_seq bigint NOT NULL DEFAULT 0,
  last_delivered_seq bigint NOT NULL DEFAULT 0,
  muted boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_msg_id uuid NOT NULL,
  seq bigint NOT NULL,
  kind varchar(16) NOT NULL DEFAULT 'text',
  body text,
  media_id uuid,
  reply_to_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  CONSTRAINT uq_chat_client_msg UNIQUE (chat_id, client_msg_id),
  CONSTRAINT uq_chat_seq UNIQUE (chat_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_seq ON messages(chat_id, seq DESC);

CREATE TABLE IF NOT EXISTS message_deletions (
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
