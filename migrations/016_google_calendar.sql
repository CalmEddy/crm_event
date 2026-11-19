-- Per-user Google Calendar OAuth + sync mapping.
CREATE TABLE IF NOT EXISTS google_calendar_accounts (
  user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  google_email text,
  refresh_token text NOT NULL,
  access_token text,
  access_token_expires_at timestamptz,
  calendar_id text NOT NULL DEFAULT 'primary',
  sync_tasks boolean NOT NULL DEFAULT true,
  sync_events boolean NOT NULL DEFAULT true,
  enabled boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS google_calendar_links (
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity entity_type NOT NULL,
  entity_id integer NOT NULL,
  google_event_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, entity, entity_id)
);

CREATE INDEX IF NOT EXISTS google_calendar_links_google_idx
  ON google_calendar_links (user_id, google_event_id);
