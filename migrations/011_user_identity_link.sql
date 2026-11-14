-- Link a staff row to the signed-in account by its stable id, so editing the
-- row's name or email no longer makes sign-in create a second row.
ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_sub text;
CREATE UNIQUE INDEX IF NOT EXISTS users_identity_sub_idx ON users (identity_sub);
