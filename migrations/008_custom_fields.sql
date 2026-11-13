CREATE TABLE custom_fields (
  id serial PRIMARY KEY,
  entity entity_type NOT NULL,
  label text NOT NULL,
  type text NOT NULL,
  options text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX custom_fields_entity_idx ON custom_fields (entity, position);

CREATE TABLE custom_values (
  field_id integer NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  entity entity_type NOT NULL,
  entity_id integer NOT NULL,
  value text NOT NULL,
  PRIMARY KEY (field_id, entity_id)
);

CREATE INDEX custom_values_record_idx ON custom_values (entity, entity_id);
