import { randomUUID, createHmac } from 'node:crypto';
import { Controller, Inject, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { PrismaService } from '../infrastructure/prisma.service.js';

const COOKIE = 'rs_visit';
const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('analytics')
export class AnalyticsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Post('visit')
  async visit(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    let token = request.cookies?.[COOKIE];
    if (!token || !TOKEN_PATTERN.test(token)) {
      token = randomUUID();
      reply.setCookie(COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });
    }
    const key = process.env.DATA_ENCRYPTION_KEY || process.env.SESSION_SECRET;
    if (!key) throw new Error('Analytics signing key is missing');
    const visitorHash = createHmac('sha256', key).update(token).digest('hex');
    const now = new Date();
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    await this.prisma.siteVisit.upsert({
      where: { day_visitorHash: { day, visitorHash } },
      create: { day, visitorHash, lastSeenAt: now },
      update: { pageViews: { increment: 1 }, lastSeenAt: now },
    });
    return { recorded: true };
  }
}
