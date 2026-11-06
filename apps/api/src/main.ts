import 'reflect-metadata';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { parseApiEnvironment } from '@resaller/config';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { isOriginAllowed } from './common/origin-policy.js';

function loadLocalEnvironment(): void {
  if (process.env.DATABASE_URL) return;

  for (const path of ['.env', '../../.env']) {
    try {
      process.loadEnvFile(path);
      return;
    } catch {
      // Production injects environment variables; local development uses the
      // first repository-level .env file available from the current cwd.
    }
  }
}

// TRUST_PROXY means exactly one trusted hop (Caddy). Fastify then reads the
// right-most X-Forwarded-For entry, the one the proxy appended; client-supplied
// values to its left can never become request.ip and key a rate limit.
async function bootstrap(): Promise<void> {
  loadLocalEnvironment();
  const env = parseApiEnvironment(process.env);
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ trustProxy: env.TRUST_PROXY ? (_address: string, hop: number) => hop === 0 : false, logger: { level: env.LOG_LEVEL, redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'] } }));
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableCors({ origin: env.CORS_ORIGINS, credentials: true, methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'] });
  await app.register(cookie);
  await app.register(multipart, { limits: { files: 1, fileSize: 5 * 1024 * 1024, fields: 1, parts: 2 } });
  await app.register(helmet, { contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], frameAncestors: ["'none'"], objectSrc: ["'none'"] } } });
  await app.register(rateLimit, {
    // Browser suites and local development legitimately make many requests
    // from one loopback address. Keep the stricter public limit in production.
    max: env.NODE_ENV === 'production' ? 120 : 1_000,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.ip,
  });
  app.getHttpAdapter().getInstance().addHook('onRequest', async (request, reply) => {
    if (!isOriginAllowed(request.method, request.headers.origin, env.CORS_ORIGINS)) {
      // Returning the reply is the documented way for an async hook to stop
      // the request, and it keeps the short-circuit explicit rather than
      // relying on Fastify noticing the reply was already sent.
      return reply.code(403).send({ code: 'ORIGIN_FORBIDDEN', message: 'Cross-site request blocked', requestId: request.id });
    }
    return undefined;
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(env.API_PORT, env.API_HOST);
}
void bootstrap();
