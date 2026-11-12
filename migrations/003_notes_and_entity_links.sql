CREATE TYPE entity_type AS ENUM ('contact', 'organization', 'event', 'task');

CREATE TABLE notes (
  id serial PRIMARY KEY,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE note_links (
  id serial PRIMARY KEY,
  note_id integer NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  entity_type entity_type NOT NULL,
  entity_id integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX note_links_note_entity_idx
  ON note_links (note_id, entity_type, entity_id);

CREATE INDEX note_links_entity_idx
  ON note_links (entity_type, entity_id);

CREATE TABLE entity_links (
  id serial PRIMARY KEY,
  left_type entity_type NOT NULL,
  left_id integer NOT NULL,
  right_type entity_type NOT NULL,
  right_id integer NOT NULL,
  role text NOT NULL DEFAULT 'related',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX entity_links_pair_role_idx
  ON entity_links (left_type, left_id, right_type, right_id, role);

CREATE INDEX entity_links_left_idx
  ON entity_links (left_type, left_id);

CREATE INDEX entity_links_right_idx
  ON entity_links (right_type, right_id);
