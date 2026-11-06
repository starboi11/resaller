import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../infrastructure/prisma.service.js';
import { ownerStoreUsername } from '../resale/resale-visibility.js';

/**
 * OWNER_STORE_USERNAME must name a real, active store. A typo would silently
 * show buyers an empty shop, so deployed environments refuse to start and
 * local development logs a loud warning.
 */
@Injectable()
export class OwnerStoreCheck implements OnApplicationBootstrap {
  private readonly logger = new Logger(OwnerStoreCheck.name);
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    const username = ownerStoreUsername();
    const deployed = ['production', 'staging'].includes(process.env.NODE_ENV ?? '');
    if (!username) {
      this.logger.warn('OWNER_STORE_USERNAME is not set: buyers see every store (local setup only).');
      return;
    }
    const store = await this.prisma.store.findUnique({ where: { username }, select: { status: true } });
    const problem = !store ? `no store with username "${username}"` : store.status !== 'ACTIVE' ? `store "${username}" is ${store.status}, not ACTIVE` : null;
    if (!problem) return;
    const message = `OWNER_STORE_USERNAME points to ${problem}. Set it to the owner's real store username.`;
    if (deployed) throw new Error(message);
    this.logger.error(message);
  }
}
