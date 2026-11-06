import { z } from 'zod';

const optionalUrl = z.preprocess((value) => value === '' ? undefined : value, z.string().url().optional());
const optionalSecret = z.preprocess((value) => value === '' ? undefined : value, z.string().min(1).optional());

export const apiEnvironmentSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'staging', 'production'])
      .default('development'),
    API_PORT: z.coerce.number().int().positive().default(4000),
    API_HOST: z.string().default('0.0.0.0'),
    TRUST_PROXY: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().url(),
    SESSION_SECRET: z.string().min(32),
    // Keep encrypted long-lived data independent from session rotation. Existing
    // development data may use SESSION_SECRET until a dedicated key is supplied.
    DATA_ENCRYPTION_KEY: z.string().min(32).optional(),
    // Set only while rotating DATA_ENCRYPTION_KEY: reads accept the previous
    // generation until every stored row has been re-encrypted.
    DATA_ENCRYPTION_KEY_PREVIOUS: z.string().min(32).optional(),
    PUBLIC_WEB_URL: optionalUrl,
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .default('info'),
    CORS_ORIGINS: z
      .string()
      .transform((value) => value.split(',').map((item) => item.trim()))
      .pipe(z.array(z.string().url()).min(1)),
    MEDIA_ROOT: z.string().min(1).default('./data/media'),
    PRIVATE_MEDIA_ROOT: z.string().min(1).default('./data/private-media'),
    MEDIA_STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    // These stay blank in .env.example because local development uses the
    // 'local' media driver, so an empty value must read as "not configured"
    // rather than as an invalid one. superRefine still requires them whenever
    // MEDIA_STORAGE_DRIVER is 's3'.
    S3_ENDPOINT: optionalUrl,
    S3_REGION: z.string().min(1).default('auto'),
    S3_BUCKET: optionalSecret,
    S3_PRIVATE_BUCKET: optionalSecret,
    S3_ACCESS_KEY_ID: optionalSecret,
    S3_SECRET_ACCESS_KEY: optionalSecret,
    S3_FORCE_PATH_STYLE: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    EMAIL_WEBHOOK_URL: optionalUrl,
    EMAIL_WEBHOOK_TOKEN: optionalSecret,
    TELEGRAM_SUPPORT_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    TELEGRAM_BOT_TOKEN: optionalSecret,
    TELEGRAM_WEBHOOK_SECRET: optionalSecret,
    TELEGRAM_SUPPORT_CHAT_ID: optionalSecret,
    TELEGRAM_SUPPORT_OPERATOR_NAME: z.string().min(1).default('Resaller Support'),
    TELEGRAM_WEBHOOK_URL: optionalUrl,
    PUSH_WEBHOOK_URL: optionalUrl,
    PUSH_WEBHOOK_TOKEN: optionalSecret,
    METRICS_TOKEN: optionalSecret,
    // Only the owner sells (2026-11-03). Buyers see this store's listings only.
    // Admin TOTP (owner decision 2026-11-04: off, with a 16+ char random
    // password from `pnpm --filter @resaller/api admin:account`). Default on.
    ADMIN_TWO_FACTOR_REQUIRED: z.enum(['true', 'false']).default('true'),
    OWNER_STORE_USERNAME: z.preprocess((value) => value === '' ? undefined : value, z.string().regex(/^[a-z0-9_]{3,32}$/).optional()),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === 'production' || value.NODE_ENV === 'staging') {
      for (const field of ['DATA_ENCRYPTION_KEY', 'METRICS_TOKEN'] as const) {
        if ((value[field]?.length ?? 0) < 32)
          context.addIssue({ code: 'custom', path: [field], message: `${field} requires at least 32 characters in deployed environments` });
      }
      if (value.MEDIA_STORAGE_DRIVER !== 's3')
        context.addIssue({ code: 'custom', path: ['MEDIA_STORAGE_DRIVER'], message: 'Deployed environments require S3 media storage' });
      for (const field of ['PUBLIC_WEB_URL', 'S3_ENDPOINT', 'EMAIL_WEBHOOK_URL'] as const) {
        if (!value[field]?.startsWith('https://'))
          context.addIssue({ code: 'custom', path: [field], message: `${field} requires HTTPS in deployed environments` });
      }
      if (!value.OWNER_STORE_USERNAME)
        context.addIssue({ code: 'custom', path: ['OWNER_STORE_USERNAME'], message: 'OWNER_STORE_USERNAME is required: buyers may only see the owner store' });
      if (!value.EMAIL_WEBHOOK_TOKEN)
        context.addIssue({ code: 'custom', path: ['EMAIL_WEBHOOK_TOKEN'], message: 'Email recovery delivery must be configured' });
      if (value.CORS_ORIGINS.some((origin) => !origin.startsWith('https://')))
        context.addIssue({ code: 'custom', path: ['CORS_ORIGINS'], message: 'Deployed browser origins require HTTPS' });
    }
    if (value.MEDIA_STORAGE_DRIVER === 's3' && value.S3_BUCKET && value.S3_BUCKET === value.S3_PRIVATE_BUCKET)
      context.addIssue({ code: 'custom', path: ['S3_PRIVATE_BUCKET'], message: 'Public and private media must use separate buckets' });
    if (value.MEDIA_STORAGE_DRIVER === 's3') {
      for (const field of [
        'S3_ENDPOINT',
        'S3_BUCKET',
        'S3_PRIVATE_BUCKET',
        'S3_ACCESS_KEY_ID',
        'S3_SECRET_ACCESS_KEY',
      ] as const) {
        if (!value[field])
          context.addIssue({
            code: 'custom',
            path: [field],
            message: `${field} is required for S3 media storage`,
          });
      }
    }
    if (value.TELEGRAM_SUPPORT_ENABLED) {
      for (const field of [
        'TELEGRAM_BOT_TOKEN',
        'TELEGRAM_WEBHOOK_SECRET',
        'TELEGRAM_SUPPORT_CHAT_ID',
        'TELEGRAM_WEBHOOK_URL',
      ] as const) {
        if (!value[field])
          context.addIssue({
            code: 'custom',
            path: [field],
            message: `${field} is required for Telegram support`,
          });
      }
      if ((value.TELEGRAM_WEBHOOK_SECRET?.length ?? 0) < 32)
        context.addIssue({
          code: 'custom',
          path: ['TELEGRAM_WEBHOOK_SECRET'],
          message: 'TELEGRAM_WEBHOOK_SECRET must contain at least 32 characters',
        });
    }
  });

export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>;
export const parseApiEnvironment = (
  environment: Record<string, string | undefined>,
): ApiEnvironment => apiEnvironmentSchema.parse(environment);
