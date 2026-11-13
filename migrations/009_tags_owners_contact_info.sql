-- Standard contact details.
ALTER TABLE contacts
  ADD COLUMN mobile text,
  ADD COLUMN website text,
  ADD COLUMN address text,
  ADD COLUMN city text,
  ADD COLUMN region text,
  ADD COLUMN postal_code text,
  ADD COLUMN country text;

ALTER TABLE organizations
  ADD COLUMN email text,
  ADD COLUMN phone text,
  ADD COLUMN website text,
  ADD COLUMN region text,
  ADD COLUMN postal_code text,
  ADD COLUMN country text;

-- Tags shared by every record type.
CREATE TABLE tags (
  id serial PRIMARY KEY,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'slate',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX tags_name_idx ON tags (lower(name));

CREATE TABLE record_tags (
  tag_id integer NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  entity entity_type NOT NULL,
  entity_id integer NOT NULL,
  PRIMARY KEY (tag_id, entity, entity_id)
);
CREATE INDEX record_tags_record_idx ON record_tags (entity, entity_id);

-- Owners (several users) for contacts and organizations.
CREATE TABLE record_owners (
  entity entity_type NOT NULL,
  entity_id integer NOT NULL,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (entity, entity_id, user_id)
);
