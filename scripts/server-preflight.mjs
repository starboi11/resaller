import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function validateDeployment(config, { directory, staging = false, projectName = 'resaller-prod' }) {
  const errors = [];
  const env = config.services?.api?.environment ?? {};
  const requireValue = (name, value, minimum = 1) => {
    if (typeof value !== 'string' || value.length < minimum || /replace-with|ACCOUNT_ID|store-only|HAQIQIY_|YANGI_R2_/i.test(value))
      errors.push(`${name}: missing, too short or still a placeholder`);
  };
  const requireHttps = (name, value) => {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || /^(localhost|127\.|\[::1\])/.test(url.hostname)) throw new Error();
    } catch { errors.push(`${name}: a public HTTPS URL is required`); }
  };
  const domain = config.services?.proxy?.environment?.DOMAIN;
  if (typeof domain !== 'string' || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain))
    errors.push('DOMAIN: a valid hostname is required');
  if (staging && !/(^|\.)(stage|staging)\./i.test(domain ?? ''))
    errors.push('STAGING_DOMAIN: use a dedicated stage/staging hostname');
  if (config.name !== (staging ? 'resaller-staging' : projectName))
    errors.push('Compose project name: preserve the explicit production project; staging must use resaller-staging');
  for (const [service, settings] of Object.entries(config.services ?? {})) {
    if (service !== 'proxy' && settings.ports?.length)
      errors.push(`${service}: internal service must not expose a host port`);
    if (settings.container_name) errors.push(`${service}: shared container_name breaks project isolation`);
  }
  if (env.NODE_ENV !== 'production' || env.MEDIA_STORAGE_DRIVER !== 's3')
    errors.push('API: production mode and S3 media storage are required');
  for (const key of ['SESSION_SECRET', 'DATA_ENCRYPTION_KEY', 'METRICS_TOKEN']) requireValue(key, env[key], 32);
  for (const key of ['S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_BUCKET', 'S3_PRIVATE_BUCKET', 'EMAIL_WEBHOOK_TOKEN', 'CLAMAV_HOST']) requireValue(key, env[key]);
  for (const key of ['S3_ENDPOINT', 'EMAIL_WEBHOOK_URL', 'PUBLIC_WEB_URL']) requireHttps(key, env[key]);
  if (env.PUBLIC_WEB_URL !== `https://${domain}` || env.CORS_ORIGINS !== `https://${domain},https://admin.${domain}`)
    errors.push('API: public URL and allowed browser origins must match this deployment');
  if (env.S3_BUCKET === env.S3_PRIVATE_BUCKET) errors.push('S3: public and private media require separate buckets');
  if (env.SESSION_SECRET === env.DATA_ENCRYPTION_KEY) errors.push('Encryption key must differ from the session secret');
  const dbEnv = config.services?.postgres?.environment ?? {};
  const redisEnv = config.services?.redis?.environment ?? {};
  requireValue('POSTGRES_PASSWORD', dbEnv.POSTGRES_PASSWORD, 32);
  requireValue('REDIS_PASSWORD', redisEnv.REDIS_PASSWORD, 32);
  for (const [key, service, password] of [['DATABASE_URL', 'postgres', dbEnv.POSTGRES_PASSWORD], ['REDIS_URL', 'redis', redisEnv.REDIS_PASSWORD]]) {
    try {
      const url = new URL(env[key]);
      if (url.hostname !== service || decodeURIComponent(url.password) !== password) throw new Error();
    } catch { errors.push(`${key}: connection must match its private service and password; use URL-safe passwords`); }
  }
  const backupEnv = config.services?.backup?.environment ?? {};
  requireValue('BACKUP_ENCRYPTION_KEY', backupEnv.BACKUP_ENCRYPTION_KEY, 32);
  for (const key of ['BACKUP_S3_BUCKET', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']) requireValue(`backup ${key}`, backupEnv[key]);
  requireHttps('BACKUP_S3_ENDPOINT', backupEnv.BACKUP_S3_ENDPOINT);
  if ([env.SESSION_SECRET, env.DATA_ENCRYPTION_KEY].includes(backupEnv.BACKUP_ENCRYPTION_KEY)) errors.push('Backup encryption key must be independent');
  if ([env.S3_BUCKET, env.S3_PRIVATE_BUCKET].includes(backupEnv.BACKUP_S3_BUCKET)) errors.push('Backups require a dedicated bucket');
  for (const file of ['metrics_token', 'alertmanager_webhook_url']) {
    try {
      const path = resolve(directory, '.secrets', file);
      if (!lstatSync(path).isFile()) throw new Error();
      const content = readFileSync(path, 'utf8').trim();
      if (file === 'metrics_token' && content !== env.METRICS_TOKEN) errors.push('metrics_token: must match METRICS_TOKEN');
      if (file === 'alertmanager_webhook_url') requireHttps('alertmanager webhook', content);
    } catch { errors.push(`.secrets/${file}: required regular file is missing`); }
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const staging = args.includes('--staging');
  const projectIndex = args.indexOf('--project-name');
  const projectName = projectIndex === -1 ? 'resaller-prod' : args[projectIndex + 1];
  if (!projectName || !/^[a-z0-9][a-z0-9_-]*$/.test(projectName)) { console.error('FAIL: invalid Compose project name'); process.exit(2); }
  const envIndex = args.indexOf('--env-file');
  const envFile = envIndex === -1 ? (staging ? '.env.staging' : '.env.production') : args[envIndex + 1];
  if (!envFile) { console.error('FAIL: --env-file requires a path'); process.exit(2); }
  try {
    const command = ['compose', '--project-name', staging ? 'resaller-staging' : projectName, '--env-file', envFile, '-f', 'compose.production.yml'];
    if (staging) command.push('-f', 'compose.staging.yml');
    command.push('config', '--format', 'json');
    // Hold interpolated credentials in memory only; never print Compose config.
    const config = JSON.parse(execFileSync('docker', command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
    const errors = validateDeployment(config, { directory: process.cwd(), staging, projectName });
    if (errors.length) { console.error(errors.map((error) => `FAIL: ${error}`).join('\n')); process.exit(1); }
    const migrations = readdirSync('apps/api/prisma/migrations', { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;
    console.log(`PASS: ${staging ? 'staging' : 'production'} configuration; ${migrations} migrations in source. No server state changed. External provider access still needs live testing.`);
  } catch {
    console.error('FAIL: deployment configuration could not be loaded. Check Docker Compose, the protected env file and required variable names. Secret values are not printed.');
    process.exit(1);
  }
}
