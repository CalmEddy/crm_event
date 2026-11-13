CREATE TABLE dashboard_layouts (
  user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  widgets text NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);
