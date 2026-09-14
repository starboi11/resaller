import { describe, expect, it } from 'vitest';
import { parseApiEnvironment } from './index.js';

const base = {
  DATABASE_URL: 'postgresql://localhost/resaller',
  REDIS_URL: 'redis://localhost:6379',
  SESSION_SECRET: 'a-secure-session-secret-with-32-characters',
  CORS_ORIGINS: 'https://resaller.uz',
};

describe('R2 environment', () => {
  it('requires separate public and private buckets', () => {
    expect(() =>
      parseApiEnvironment({
        ...base,
        MEDIA_STORAGE_DRIVER: 's3',
        S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
        S3_BUCKET: 'resaller-media',
        S3_ACCESS_KEY_ID: 'access-key',
        S3_SECRET_ACCESS_KEY: 'secret-key',
      }),
    ).toThrow(/S3_PRIVATE_BUCKET/);
  });

  it('accepts a complete private R2 configuration', () => {
    const environment = parseApiEnvironment({
      ...base,
      MEDIA_STORAGE_DRIVER: 's3',
      S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
      S3_BUCKET: 'resaller-media',
      S3_PRIVATE_BUCKET: 'resaller-private-media',
      S3_ACCESS_KEY_ID: 'access-key',
      S3_SECRET_ACCESS_KEY: 'secret-key',
      S3_FORCE_PATH_STYLE: 'false',
    });
    expect(environment.S3_PRIVATE_BUCKET).toBe('resaller-private-media');
    expect(environment.S3_FORCE_PATH_STYLE).toBe(false);
  });
});
