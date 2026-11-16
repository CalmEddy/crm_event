-- Automations improvements: priority, rate limits, approval, skip reasons, timezone.
ALTER TABLE automations ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 100;
ALTER TABLE automations ADD COLUMN IF NOT EXISTS require_approval boolean NOT NULL DEFAULT false;
ALTER TABLE automations ADD COLUMN IF NOT EXISTS rate_limit_per_hour integer;
ALTER TABLE automations ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'local';

CREATE INDEX IF NOT EXISTS automations_priority_idx ON automations (enabled, priority, id);

ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS skip_reason text;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS dry_run boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS automation_approvals (
  id serial PRIMARY KEY,
  automation_id integer NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  trigger_entity entity_type NOT NULL,
  trigger_record_id integer NOT NULL,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  -- pending | approved | rejected
  detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by integer REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS automation_approvals_pending_idx
  ON automation_approvals (status, created_at DESC);
