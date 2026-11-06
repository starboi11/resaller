import { describe, expect, it } from 'vitest';
import { parseApiEnvironment } from './index.js';

const base = { DATABASE_URL: 'postgresql://local:test@localhost/resaller_e2e', REDIS_URL: 'redis://localhost:6379', SESSION_SECRET: 'local-test-session-secret-at-least-32-characters', CORS_ORIGINS: 'http://localhost:3000' };
describe('deployment environment', () => {
  it('keeps local development usable', () => expect(parseApiEnvironment(base).MEDIA_STORAGE_DRIVER).toBe('local'));
  it('rejects direct production startup without encryption, storage and recovery configuration', () => {
    expect(() => parseApiEnvironment({ ...base, NODE_ENV: 'production' })).toThrow();
  });
  it('rejects wildcard or empty CORS origins', () => {
    for (const CORS_ORIGINS of ['', '*']) expect(() => parseApiEnvironment({ ...base, CORS_ORIGINS })).toThrow();
  });
  it('accepts configured production and separates private media', () => {
    const configured = { ...base, NODE_ENV: 'production', CORS_ORIGINS: 'https://resaller.uz,https://admin.resaller.uz',
      DATA_ENCRYPTION_KEY: 'test-only-independent-encryption-key-at-least-32', METRICS_TOKEN: 'test-only-metrics-token-at-least-32-characters',
      MEDIA_STORAGE_DRIVER: 's3', PUBLIC_WEB_URL: 'https://resaller.uz', S3_ENDPOINT: 'https://storage.example.com',
      S3_BUCKET: 'media', S3_PRIVATE_BUCKET: 'private', S3_ACCESS_KEY_ID: 'test-only', S3_SECRET_ACCESS_KEY: 'test-only',
      EMAIL_WEBHOOK_URL: 'https://mail.example.com/send', EMAIL_WEBHOOK_TOKEN: 'test-only', OWNER_STORE_USERNAME: 'resaller' };
    expect(parseApiEnvironment(configured).NODE_ENV).toBe('production');
    expect(() => parseApiEnvironment({ ...configured, S3_PRIVATE_BUCKET: 'media' })).toThrow();
    // Only the owner sells: production must name the one store buyers may see.
    expect(() => parseApiEnvironment({ ...configured, OWNER_STORE_USERNAME: '' })).toThrow(/OWNER_STORE_USERNAME/);
    expect(() => parseApiEnvironment({ ...configured, OWNER_STORE_USERNAME: 'Bad Name!' })).toThrow();
  });
});

describe('the documented local onboarding path', () => {
  it('accepts .env.example values, whose optional secrets are blank', () => {
    expect(() => parseApiEnvironment({ ...base, MEDIA_STORAGE_DRIVER: 'local',
      S3_ENDPOINT: '', S3_BUCKET: '', S3_PRIVATE_BUCKET: '', S3_ACCESS_KEY_ID: '', S3_SECRET_ACCESS_KEY: '',
      EMAIL_WEBHOOK_URL: '', EMAIL_WEBHOOK_TOKEN: '', METRICS_TOKEN: '', PUSH_WEBHOOK_URL: '' })).not.toThrow();
  });

  it('still demands S3 credentials once the S3 driver is selected', () => {
    expect(() => parseApiEnvironment({ ...base, MEDIA_STORAGE_DRIVER: 's3',
      S3_ENDPOINT: '', S3_BUCKET: '', S3_ACCESS_KEY_ID: '', S3_SECRET_ACCESS_KEY: '' })).toThrow();
  });
});
