import { spawnSync } from 'node:child_process';
import pg from 'pg';

if (!process.env.CI) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error('DATABASE_URL is required for browser tests');

  const target = new URL(databaseUrl);
  const databaseName = target.pathname.slice(1);
  if (databaseName !== 'resaller_e2e')
    throw new Error(`Refusing to reset non-E2E database: ${databaseName}`);

  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const existing = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [databaseName],
    );
    if (existing.rowCount === 0)
      await admin.query(`CREATE DATABASE "${databaseName}"`);
  } finally {
    await admin.end();
  }

  const database = new pg.Client({ connectionString: databaseUrl });
  await database.connect();
  try {
    await database.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  } finally {
    await database.end();
  }

  const migration =
    process.platform === 'win32'
      ? spawnSync(
          process.env.ComSpec ?? 'cmd.exe',
          ['/d', '/s', '/c', 'pnpm --filter @resaller/api db:migrate:deploy'],
          { env: process.env, encoding: 'utf8', stdio: 'inherit' },
        )
      : spawnSync('pnpm', ['--filter', '@resaller/api', 'db:migrate:deploy'], {
          env: process.env,
          encoding: 'utf8',
          stdio: 'inherit',
        });
  if (migration.status !== 0)
    throw new Error('Failed to apply migrations to the E2E database');
}
