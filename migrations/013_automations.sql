-- Team-wide automations: triggers, conditions, and actions stored as JSON.
-- "trigger" must be quoted — TRIGGER is reserved in Postgres.
ALTER TYPE notification_kind ADD VALUE IF NOT EXISTS 'automation';

CREATE TABLE automations (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  -- contact | organization | event | task | null when entity is only on the trigger JSON
  entity entity_type,
  "trigger" jsonb NOT NULL,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX automations_enabled_idx ON automations (enabled);

CREATE TABLE automation_runs (
  id serial PRIMARY KEY,
  automation_id integer NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  status text NOT NULL,
  -- ok | skipped | error
  trigger_entity entity_type,
  trigger_record_id integer,
  detail text NOT NULL DEFAULT '',
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX automation_runs_automation_idx ON automation_runs (automation_id, started_at DESC);
CREATE INDEX automation_runs_record_idx ON automation_runs (trigger_entity, trigger_record_id);

-- Dedup for schedule / date-offset fires (one successful fire per key).
CREATE TABLE automation_fire_log (
  automation_id integer NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  fire_key text NOT NULL,
  fired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (automation_id, fire_key)
);
