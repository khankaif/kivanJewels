-- Storefront newsletter sign-ups. The only table the public store host writes.
--
-- The email is the key, stored lower-cased, so signing up twice is a no-op
-- (INSERT ... ON CONFLICT DO NOTHING) and the list never holds duplicates.
-- 254 is the longest valid address (RFC 5321); the cap stops a bot filling
-- rows with megabytes of junk.

CREATE TABLE newsletter_signups (
  email      text PRIMARY KEY CHECK (email = lower(email) AND length(email) <= 254),
  created_at timestamptz NOT NULL DEFAULT now()
);
