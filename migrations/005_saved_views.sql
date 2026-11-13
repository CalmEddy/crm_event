CREATE TABLE saved_views (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity entity_type NOT NULL,
  name text NOT NULL,
  query text NOT NULL DEFAULT '',
  shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX saved_views_entity_user_idx ON saved_views (entity, user_id);
