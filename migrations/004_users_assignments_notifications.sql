CREATE TYPE notification_kind AS ENUM ('assignment', 'record_change', 'task_due');

CREATE TABLE users (
  id serial PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_idx ON users (email);
CREATE INDEX users_active_idx ON users (active);

CREATE TABLE event_assignees (
  id serial PRIMARY KEY,
  event_id integer NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX event_assignees_event_user_idx
  ON event_assignees (event_id, user_id);
CREATE INDEX event_assignees_user_id_idx ON event_assignees (user_id);

CREATE TABLE task_assignees (
  id serial PRIMARY KEY,
  task_id integer NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX task_assignees_task_user_idx
  ON task_assignees (task_id, user_id);
CREATE INDEX task_assignees_user_id_idx ON task_assignees (user_id);

CREATE TABLE notification_log (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind notification_kind NOT NULL,
  entity_type text NOT NULL,
  entity_id integer NOT NULL,
  dedupe_key text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  error text
);

CREATE UNIQUE INDEX notification_log_dedupe_key_idx
  ON notification_log (dedupe_key);
CREATE INDEX notification_log_user_id_idx ON notification_log (user_id);
CREATE INDEX notification_log_sent_at_idx ON notification_log (sent_at DESC);
