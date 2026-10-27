// Loaded via `--import` (after --env-file) before any test module, so db/client.ts sees the
// already-swapped DATABASE_URL. Tests TRUNCATE tables; this guard is the only
// thing standing between a typo and the real books.

const test = process.env.TEST_DATABASE_URL;
const prod = process.env.DATABASE_URL;

if (!test || test.includes('ep-yyy') || test.includes('REGION')) {
  throw new Error(
    'TEST_DATABASE_URL is unset or still the placeholder from .env.local.example.\n' +
      'Create a separate Neon branch for tests and set TEST_DATABASE_URL to its connection string.\n' +
      'Tests truncate tables and must never run against the branch in DATABASE_URL.',
  );
}
if (test === prod) {
  throw new Error('TEST_DATABASE_URL must not equal DATABASE_URL. Tests truncate tables.');
}

process.env.DATABASE_URL = test;
