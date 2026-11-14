-- Per-user notification channels (email, SMS, Telegram) and preferences.
ALTER TYPE notification_kind ADD VALUE IF NOT EXISTS 'note_added';

ALTER TABLE users ADD COLUMN phone text;
ALTER TABLE users ADD COLUMN telegram_chat_id text;
ALTER TABLE users ADD COLUMN telegram_link_code text;
-- How many days before a task's due date the daily reminder starts listing it.
ALTER TABLE users ADD COLUMN reminder_lead_days integer NOT NULL DEFAULT 1;

-- One row per user / kind / channel. No row means the default (email on, others off).
CREATE TABLE notification_prefs (
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  channel text NOT NULL,
  enabled boolean NOT NULL,
  PRIMARY KEY (user_id, kind, channel)
);

ALTER TABLE notification_log ADD COLUMN channel text NOT NULL DEFAULT 'email';
