import { describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { SellerCenterService } from './seller-center.service.js';
import type { AuthenticatedUser } from '../auth/session.guard.js';
import type { PrismaService } from '../infrastructure/prisma.service.js';
import type { EndpointCryptoService } from '../notifications/endpoint-crypto.service.js';

const user: AuthenticatedUser = { id: 'owner-1', publicId: 'public-user', username: 'seller', roles: [], createdAt: new Date() };
const store = { id: 'store-1', publicId: 'store-public', username: 'shop', nameUz: 'Shop', status: 'ACTIVE',
  sellerProfile: { userId: 'owner-1', verifiedAt: new Date() }, members: [] };

function harness(paymentStatus: string) {
  const tx = {
    externalOrder: {
      findFirst: vi.fn().mockResolvedValue({ id: 'order-1', paymentStatus }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: { create: vi.fn() },
  };
  const prisma = {
    store: { findUnique: vi.fn().mockResolvedValue(store) },
    $transaction: vi.fn(async (callback: (transaction: unknown) => Promise<unknown>) => callback(tx)),
  };
  return { tx, service: new SellerCenterService(prisma as unknown as PrismaService, {} as EndpointCryptoService) };
}

const change = (service: SellerCenterService, status: string) =>
  service.updatePaymentRecord(user, 'store-public', 'order-public', { status, reason: 'cash received' });

describe('external order payment record', () => {
  it('records a forward transition with an optimistic status guard', async () => {
    const { service, tx } = harness('UNPAID');
    await expect(change(service, 'PAID')).resolves.toMatchObject({ paymentStatus: 'PAID', unchanged: false });
    expect(tx.externalOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 'order-1', paymentStatus: 'UNPAID' }, data: { paymentStatus: 'PAID' },
    });
  });

  it('refuses to move a refunded order back into revenue', async () => {
    const { service, tx } = harness('REFUNDED');
    await expect(change(service, 'PAID')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.externalOrder.updateMany).not.toHaveBeenCalled();
  });

  it('lets a seller correct a collection mistake between UNPAID, PARTIAL and PAID', async () => {
    const { service, tx } = harness('PAID');
    await expect(change(service, 'UNPAID')).resolves.toMatchObject({ paymentStatus: 'UNPAID', unchanged: false });
    expect(tx.externalOrder.updateMany).toHaveBeenCalledOnce();
  });

  it('allows a refund from a delivered order that was never marked PAID', async () => {
    // finance() counts a delivered order as revenue regardless of PAID, so a
    // cash-on-delivery refund has to be reachable straight from UNPAID.
    const { service } = harness('UNPAID');
    await expect(change(service, 'REFUNDED')).resolves.toMatchObject({ paymentStatus: 'REFUNDED' });
  });

  it('keeps REFUNDED terminal in every direction', async () => {
    for (const target of ['UNPAID', 'PARTIAL', 'PAID']) {
      const { service, tx } = harness('REFUNDED');
      await expect(change(service, target)).rejects.toBeInstanceOf(ConflictException);
      expect(tx.externalOrder.updateMany).not.toHaveBeenCalled();
    }
  });

  it('treats a repeated submission as unchanged instead of rewriting history', async () => {
    const { service, tx } = harness('PAID');
    await expect(change(service, 'PAID')).resolves.toMatchObject({ paymentStatus: 'PAID', unchanged: true });
    expect(tx.externalOrder.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('reports a lost optimistic race as a conflict', async () => {
    const { service, tx } = harness('UNPAID');
    tx.externalOrder.updateMany.mockResolvedValue({ count: 0 });
    await expect(change(service, 'PAID')).rejects.toBeInstanceOf(ConflictException);
  });
});
