export function testDatabaseUrl(): string {
  const value = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!value) throw new Error('A dedicated E2E_DATABASE_URL is required for database-backed browser tests');
  const name = new URL(value).pathname.slice(1);
  if (!name.endsWith('_e2e') && !(process.env.CI && name === 'ci'))
    throw new Error('Browser fixtures may only modify a dedicated *_e2e database (or CI database)');
  return value;
}
