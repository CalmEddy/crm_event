CREATE TABLE activity_log (
  id serial PRIMARY KEY,
  entity entity_type NOT NULL,
  entity_id integer NOT NULL,
  user_id integer REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  label text NOT NULL DEFAULT '',
  detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX activity_log_entity_idx ON activity_log (entity, entity_id, created_at DESC);
CREATE INDEX activity_log_created_idx ON activity_log (created_at DESC);
