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
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().url(),
    SESSION_SECRET: z.string().min(32),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .default('info'),
    CORS_ORIGINS: z
      .string()
      .transform((value) => value.split(',').map((item) => item.trim())),
    MEDIA_ROOT: z.string().min(1).default('./data/media'),
    PRIVATE_MEDIA_ROOT: z.string().min(1).default('./data/private-media'),
    MEDIA_STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    S3_ENDPOINT: z.string().url().optional(),
    S3_REGION: z.string().min(1).default('auto'),
    S3_BUCKET: z.string().min(1).optional(),
    S3_PRIVATE_BUCKET: z.string().min(1).optional(),
    S3_ACCESS_KEY_ID: z.string().min(1).optional(),
    S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    S3_FORCE_PATH_STYLE: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    EMAIL_WEBHOOK_URL: optionalUrl,
    EMAIL_WEBHOOK_TOKEN: optionalSecret,
    TELEGRAM_BOT_TOKEN: optionalSecret,
    TELEGRAM_WEBHOOK_SECRET: optionalSecret,
    TELEGRAM_SUPPORT_CHAT_ID: optionalSecret,
    TELEGRAM_SUPPORT_OPERATOR_NAME: z.string().min(1).default('Resaller Support'),
    TELEGRAM_WEBHOOK_URL: optionalUrl,
    PUSH_WEBHOOK_URL: optionalUrl,
    PUSH_WEBHOOK_TOKEN: optionalSecret,
    METRICS_TOKEN: optionalSecret,
  })
  .superRefine((value, context) => {
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
    if (value.TELEGRAM_BOT_TOKEN) {
      for (const field of [
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
