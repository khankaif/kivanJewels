import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql, runSqlFile } from '../db/client';

const dir = join(process.cwd(), 'db/migrations');

async function main() {
  await sql`CREATE TABLE IF NOT EXISTS _migrations (
    name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()
  )`;
  const done = new Set((await sql`SELECT name FROM _migrations`).map((r: any) => r.name));

  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  let applied = 0;
  for (const name of files) {
    if (done.has(name)) continue;
    process.stdout.write(`applying ${name} ... `);
    await runSqlFile(readFileSync(join(dir, name), 'utf8'));
    await sql`INSERT INTO _migrations (name) VALUES (${name})`;
    console.log('ok');
    applied++;
  }
  console.log(applied ? `${applied} migration(s) applied` : 'migrations already up to date');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
