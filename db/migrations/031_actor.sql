-- Who posted it.
--
-- Every stock movement and every ledger row is now stamped with the signed-in
-- user. The value comes from a transaction-local setting rather than a column
-- passed down through twenty call sites: `runAs` sets `app.actor` right after
-- BEGIN, and the default reads it. Nothing that writes inside a transaction
-- can forget to be attributed.
ALTER TABLE movements ADD COLUMN IF NOT EXISTS created_by text
  DEFAULT NULLIF(current_setting('app.actor', true), '');
ALTER TABLE ledger    ADD COLUMN IF NOT EXISTS created_by text
  DEFAULT NULLIF(current_setting('app.actor', true), '');
ALTER TABLE memos     ADD COLUMN IF NOT EXISTS created_by text
  DEFAULT NULLIF(current_setting('app.actor', true), '');

CREATE INDEX IF NOT EXISTS movements_actor_idx ON movements (created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS ledger_actor_idx    ON ledger (created_by)    WHERE created_by IS NOT NULL;

-- Rows written before this existed are honestly blank: the app cannot say who
-- entered them, so it does not guess.

-- Failed sign-ins, for rate limiting. Rows older than the window are useless,
-- so this table is swept on every check rather than growing forever.
CREATE TABLE IF NOT EXISTS auth_attempts (
  id         bigserial PRIMARY KEY,
  email      text NOT NULL,
  ip         text,
  ok         boolean NOT NULL,
  at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_attempts_email_idx ON auth_attempts (lower(email), at DESC);
CREATE INDEX IF NOT EXISTS auth_attempts_ip_idx    ON auth_attempts (ip, at DESC) WHERE ip IS NOT NULL;
