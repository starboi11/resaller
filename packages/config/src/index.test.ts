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

describe('Telegram support environment', () => {
  it('requires the complete protected webhook configuration when enabled', () => {
    expect(() =>
      parseApiEnvironment({
        ...base,
        TELEGRAM_BOT_TOKEN: 'bot-token',
      }),
    ).toThrow(/TELEGRAM_WEBHOOK_SECRET/);
  });

  it('accepts a complete Telegram support configuration', () => {
    const environment = parseApiEnvironment({
      ...base,
      TELEGRAM_BOT_TOKEN: 'bot-token',
      TELEGRAM_WEBHOOK_SECRET: 'a-telegram-webhook-secret-with-32-characters',
      TELEGRAM_SUPPORT_CHAT_ID: '-1001234567890',
      TELEGRAM_SUPPORT_OPERATOR_NAME: 'Ziyodxon',
      TELEGRAM_WEBHOOK_URL: 'https://api.resaller.uz/api/v1/support/telegram/webhook',
    });
    expect(environment.TELEGRAM_SUPPORT_CHAT_ID).toBe('-1001234567890');
    expect(environment.TELEGRAM_SUPPORT_OPERATOR_NAME).toBe('Ziyodxon');
  });
});
