import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateDeployment } from './server-preflight.mjs';

function deploymentFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'resaller-preflight-test-'));
  mkdirSync(join(directory, '.secrets'));
  const session = 'session-test-only-'.repeat(3), encryption = 'encryption-test-only-'.repeat(3);
  const metrics = 'metrics-test-only-'.repeat(3), db = 'database-test-only-'.repeat(3), redis = 'redis-test-only-'.repeat(3);
  writeFileSync(join(directory, '.secrets', 'metrics_token'), metrics);
  writeFileSync(join(directory, '.secrets', 'alertmanager_webhook_url'), 'https://alerts.example.com/operator');
  const config = { name: 'resaller-staging', services: {
    proxy: { environment: { DOMAIN: 'staging.resaller.uz' }, ports: [{ target: 443 }] },
    api: { environment: { NODE_ENV: 'production', MEDIA_STORAGE_DRIVER: 's3', SESSION_SECRET: session, DATA_ENCRYPTION_KEY: encryption,
      METRICS_TOKEN: metrics, DATABASE_URL: `postgresql://resaller:${db}@postgres:5432/resaller`, REDIS_URL: `redis://:${redis}@redis:6379`,
      PUBLIC_WEB_URL: 'https://staging.resaller.uz', CORS_ORIGINS: 'https://staging.resaller.uz,https://admin.staging.resaller.uz',
      S3_ENDPOINT: 'https://storage.example.com', S3_BUCKET: 'staging-media', S3_PRIVATE_BUCKET: 'staging-private', S3_ACCESS_KEY_ID: 'test-only-access',
      S3_SECRET_ACCESS_KEY: 'test-only-storage-secret', EMAIL_WEBHOOK_URL: 'https://mail.example.com/send', EMAIL_WEBHOOK_TOKEN: 'test-only-mail', CLAMAV_HOST: 'clamav' } },
    postgres: { environment: { POSTGRES_PASSWORD: db } }, redis: { environment: { REDIS_PASSWORD: redis } },
    backup: { environment: { BACKUP_ENCRYPTION_KEY: 'backup-test-only-'.repeat(3), BACKUP_S3_ENDPOINT: 'https://storage.example.com',
      BACKUP_S3_BUCKET: 'staging-backups', AWS_ACCESS_KEY_ID: 'test-only-backup', AWS_SECRET_ACCESS_KEY: 'test-only-backup-secret' } },
  } };
  return { directory, config };
}

test('preflight accepts isolated staging without exposing secret values', () => {
  const { directory, config } = deploymentFixture();
  try { assert.deepEqual(validateDeployment(config, { directory, staging: true }), []); }
  finally { rmSync(directory, { recursive: true }); }
});
test('preflight blocks shared production project, open database ports and incomplete private configuration', () => {
  const { directory, config } = deploymentFixture();
  try {
    config.name = 'resaller-prod';
    config.services.postgres.ports = [{ target: 5432 }];
    config.services.api.environment.S3_PRIVATE_BUCKET = config.services.api.environment.S3_BUCKET;
    config.services.api.environment.SESSION_SECRET = 'short';
    const errors = validateDeployment(config, { directory, staging: true });
    assert(errors.some((value) => value.includes('project name')));
    assert(errors.some((value) => value.includes('host port')));
    assert(errors.some((value) => value.includes('separate buckets')));
    assert(errors.some((value) => value.includes('SESSION_SECRET')));
    assert(!errors.join('\n').includes(config.services.api.environment.S3_SECRET_ACCESS_KEY));
  } finally { rmSync(directory, { recursive: true }); }
});

const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'sh';
function shell(script, env) {
  return spawnSync(bash, ['-c', 'if [ -n "${TEST_BIN:-}" ]; then export PATH="$TEST_BIN:$PATH"; fi; exec sh "$1"', '--', script], { encoding: 'utf8', env: { ...process.env, ...env } });
}
test('restore refuses a production database URL before any database operation', () => {
  const result = shell('infrastructure/restore-drill.sh', { DATABASE_URL: 'postgresql://test@localhost/resaller',
    DATABASE_DRILL_URL: 'postgresql://test@localhost/resaller', BACKUP_ENCRYPTION_KEY: 'test-only', BACKUP_FILE: '/not-used' });
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /target only resaller_restore_drill/);
});
test('restore refuses a drill on another database server before any database operation', () => {
  const result = shell('infrastructure/restore-drill.sh', { DATABASE_URL: 'postgresql://test@localhost/resaller',
    DATABASE_DRILL_URL: 'postgresql://test@other/resaller_restore_drill', BACKUP_ENCRYPTION_KEY: 'test-only', BACKUP_FILE: '/not-used' });
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /same server and credentials/);
});
test('backup rejects a malformed retention period before running pg_dump', () => {
  const result = shell('infrastructure/backup.sh', { DATABASE_URL: 'postgresql://test@localhost/resaller',
    BACKUP_ENCRYPTION_KEY: 'test-only', BACKUP_RETENTION_DAYS: '-1' });
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /positive integer/);
});
test('restore refuses an existing drill database without dropping it', () => {
  const directory = mkdtempSync(join(tmpdir(), 'resaller-restore-guard-test-'));
  const unixDir = directory.replaceAll('\\', '/').replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`);
  try {
    const fixtures = {
      psql: '#!/bin/sh\nprintf "%s\\n" "$*" >> "$TEST_LOG"\nprintf "1\\n"\n',
      pg_restore: '#!/bin/sh\nexit 0\n',
      openssl: '#!/bin/sh\nwhile [ "$#" -gt 0 ]; do if [ "$1" = "-out" ]; then shift; printf x > "$1"; fi; shift; done\n',
      gzip: '#!/bin/sh\nprintf "mock dump"\n',
      sha256sum: '#!/bin/sh\nexit 0\n',
    };
    for (const [name, value] of Object.entries(fixtures)) writeFileSync(join(directory, name), value, { mode: 0o755 });
    writeFileSync(join(directory, 'backup.enc'), 'fixture');
    writeFileSync(join(directory, 'backup.enc.sha256'), 'fixture');
    const result = shell('infrastructure/restore-drill.sh', { TEST_BIN: unixDir,
      TEST_LOG: `${unixDir}/commands.log`, DATABASE_URL: 'postgresql://test@localhost/resaller',
      DATABASE_DRILL_URL: 'postgresql://test@localhost/resaller_restore_drill', BACKUP_ENCRYPTION_KEY: 'test-only', BACKUP_FILE: `${unixDir}/backup.enc` });
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /Refusing to replace/);
    assert(existsSync(join(directory, 'commands.log')));
    assert(!/DROP DATABASE|CREATE DATABASE/.test(readFileSync(join(directory, 'commands.log'), 'utf8')));
  } finally { rmSync(directory, { recursive: true }); }
});
