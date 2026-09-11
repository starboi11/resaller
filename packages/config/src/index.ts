import { z } from 'zod';

export const apiEnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  CORS_ORIGINS: z.string().transform((value) => value.split(',').map((item) => item.trim())),
  MEDIA_ROOT: z.string().min(1).default('./data/media'),
  PRIVATE_MEDIA_ROOT: z.string().min(1).default('./data/private-media'),
});

export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>;
export const parseApiEnvironment = (environment: Record<string, string | undefined>): ApiEnvironment => apiEnvironmentSchema.parse(environment);
