CREATE TYPE organization_type AS ENUM ('venue', 'club', 'agency', 'promoter', 'other');
CREATE TYPE event_status AS ENUM ('inquiry', 'booked', 'completed', 'canceled');
CREATE TYPE task_kind AS ENUM ('travel', 'payment', 'call', 'email', 'follow_up', 'other');
CREATE TYPE task_status AS ENUM ('todo', 'doing', 'done', 'skipped');

CREATE TABLE organizations (
  id serial PRIMARY KEY,
  name text NOT NULL,
  type organization_type NOT NULL DEFAULT 'other',
  address text,
  city text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE contacts (
  id serial PRIMARY KEY,
  name text NOT NULL,
  email text,
  phone text,
  role text,
  notes text,
  organization_id integer REFERENCES organizations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id serial PRIMARY KEY,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  location text,
  venue text,
  venue_organization_id integer REFERENCES organizations(id) ON DELETE SET NULL,
  notes text,
  status event_status NOT NULL DEFAULT 'inquiry',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE event_contacts (
  id serial PRIMARY KEY,
  event_id integer NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  contact_id integer REFERENCES contacts(id) ON DELETE CASCADE,
  organization_id integer REFERENCES organizations(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'contact',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX event_contacts_event_contact_idx
  ON event_contacts (event_id, contact_id, role)
  WHERE contact_id IS NOT NULL;

CREATE UNIQUE INDEX event_contacts_event_org_idx
  ON event_contacts (event_id, organization_id, role)
  WHERE organization_id IS NOT NULL;

CREATE TABLE task_groups (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE task_templates (
  id serial PRIMARY KEY,
  task_group_id integer NOT NULL REFERENCES task_groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind task_kind NOT NULL DEFAULT 'other',
  offset_days integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE task_group_applications (
  id serial PRIMARY KEY,
  event_id integer NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  task_group_id integer NOT NULL REFERENCES task_groups(id) ON DELETE CASCADE,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX task_group_applications_event_group_idx
  ON task_group_applications (event_id, task_group_id);

CREATE TABLE tasks (
  id serial PRIMARY KEY,
  title text NOT NULL,
  kind task_kind NOT NULL DEFAULT 'other',
  due_on date NOT NULL,
  status task_status NOT NULL DEFAULT 'todo',
  notes text,
  event_id integer REFERENCES events(id) ON DELETE CASCADE,
  contact_id integer REFERENCES contacts(id) ON DELETE SET NULL,
  task_group_id integer REFERENCES task_groups(id) ON DELETE SET NULL,
  task_template_id integer REFERENCES task_templates(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tasks_due_on_idx ON tasks (due_on);
CREATE INDEX tasks_status_idx ON tasks (status);
CREATE INDEX tasks_event_id_idx ON tasks (event_id);
CREATE INDEX events_starts_at_idx ON events (starts_at);
