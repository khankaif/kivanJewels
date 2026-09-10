import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '@/db/client';
import {
  checkSignInAllowed, recordAttempt, MAX_PER_EMAIL, WINDOW_MINUTES,
} from '@/lib/auth/rate-limit';

const email = () => `zz-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.invalid`;
const cleanup = (e: string) => sql`DELETE FROM auth_attempts WHERE email = ${e}`;

test('an email is locked out after too many failures, and told how long', async () => {
  const e = email();
  try {
    for (let i = 0; i < MAX_PER_EMAIL - 1; i++) await recordAttempt(e, '10.0.0.1', false);
    assert.equal((await checkSignInAllowed(e, '10.0.0.1')).blocked, false, 'one attempt left');

    await recordAttempt(e, '10.0.0.1', false);
    const blocked = await checkSignInAllowed(e, '10.0.0.1');
    assert.equal(blocked.blocked, true);
    assert.ok(blocked.blocked && blocked.minutes > 0 && blocked.minutes <= WINDOW_MINUTES);
  } finally {
    await cleanup(e);
  }
});

test('signing in successfully clears the count', async () => {
  const e = email();
  try {
    for (let i = 0; i < MAX_PER_EMAIL; i++) await recordAttempt(e, '10.0.0.2', false);
    assert.equal((await checkSignInAllowed(e, '10.0.0.2')).blocked, true);

    await recordAttempt(e, '10.0.0.2', true);
    assert.equal((await checkSignInAllowed(e, '10.0.0.2')).blocked, false);
  } finally {
    await cleanup(e);
  }
});

test('failures outside the window do not count', async () => {
  const e = email();
  try {
    for (let i = 0; i < MAX_PER_EMAIL + 2; i++) await recordAttempt(e, '10.0.0.3', false);
    await sql`
      UPDATE auth_attempts SET at = now() - interval '2 hours' WHERE email = ${e}`;
    assert.equal((await checkSignInAllowed(e, '10.0.0.3')).blocked, false);
  } finally {
    await cleanup(e);
  }
});

test('another account on the same machine is judged on its own count', async () => {
  const a = email();
  const b = email();
  try {
    for (let i = 0; i < MAX_PER_EMAIL; i++) await recordAttempt(a, '10.0.0.4', false);
    assert.equal((await checkSignInAllowed(a, '10.0.0.4')).blocked, true);
    // Same IP, well under the per-IP ceiling: this one still gets to try.
    assert.equal((await checkSignInAllowed(b, '10.0.0.4')).blocked, false);
  } finally {
    await cleanup(a);
    await cleanup(b);
  }
});
