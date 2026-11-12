CREATE TYPE inbound_email_status AS ENUM ('created', 'failed', 'duplicate');

CREATE TABLE inbound_emails (
  id serial PRIMARY KEY,
  provider_message_id text NOT NULL,
  subject text,
  from_address text,
  status inbound_email_status NOT NULL,
  error text,
  contact_id integer REFERENCES contacts(id) ON DELETE SET NULL,
  event_id integer REFERENCES events(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX inbound_emails_provider_message_id_idx
  ON inbound_emails (provider_message_id);

CREATE INDEX inbound_emails_created_at_idx ON inbound_emails (created_at DESC);
CREATE INDEX inbound_emails_status_idx ON inbound_emails (status);
