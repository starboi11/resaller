import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../infrastructure/prisma.service.js';
import { EndpointCryptoService } from '../notifications/endpoint-crypto.service.js';
import { NotificationProviderService } from '../notifications/notification-provider.service.js';

@Injectable()
export class PasswordResetDeliveryService {
  private readonly logger = new Logger(PasswordResetDeliveryService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EndpointCryptoService) private readonly crypto: EndpointCryptoService,
    @Inject(NotificationProviderService) private readonly provider: NotificationProviderService,
  ) {}

  async send(userId: string, token: string): Promise<boolean> {
    const baseUrl = process.env.PUBLIC_WEB_URL;
    if (!baseUrl || !this.provider.enabled('EMAIL')) return false;
    const endpoints = await this.prisma.notificationEndpoint.findMany({
      where: { userId, channel: 'EMAIL', active: true },
      select: { id: true, valueEncrypted: true },
      take: 3,
    });
    if (!endpoints.length) return false;

    const resetUrl = new URL('/recovery', baseUrl);
    resetUrl.searchParams.set('token', token);
    let delivered = false;
    for (const endpoint of endpoints) {
      try {
        await this.provider.send('EMAIL', this.crypto.decrypt(endpoint.valueEncrypted), {
          id: `password-reset-${createHash('sha256').update(token).digest('base64url').slice(0, 24)}-${endpoint.id}`,
          type: 'PASSWORD_RESET',
          severity: 'WARNING',
          payload: {
            subject: 'Resaller hisobingiz uchun parolni tiklash',
            resetUrl: resetUrl.toString(),
            expiresInMinutes: 15,
          },
        });
        delivered = true;
      } catch (error) {
        this.logger.warn(
          `Password reset delivery failed for endpoint ${endpoint.id}: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      }
    }
    return delivered;
  }
}
