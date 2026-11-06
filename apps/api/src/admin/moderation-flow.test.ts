import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../infrastructure/prisma.service.js';
import { AdminService } from './admin.service.js';
import { EndpointCryptoService } from '../notifications/endpoint-crypto.service.js';

const admin = { id: 'admin-1' } as never;
const crypto = new EndpointCryptoService();

describe('moderation approval prerequisites', () => {
  it('cannot approve identity verification before a document is submitted', async () => {
    const update = vi.fn();
    const tx = {
      sellerVerification: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'verification-1',
          status: 'DOCUMENT_REQUIRED',
          documentStorageKey: null,
        }),
        update,
      },
    };
    const service = new AdminService({
      $transaction: (callback: (value: unknown) => Promise<unknown>) => callback(tx),
    } as unknown as PrismaService, crypto);
    await expect(
      service.moderateVerification(admin, 'verification-1', {
        status: 'APPROVED',
        reason: 'Reviewed',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(update).not.toHaveBeenCalled();
  });

  it('cannot activate a store that has not entered review', async () => {
    const update = vi.fn();
    const tx = {
      store: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'store-1',
          status: 'DRAFT',
          sellerProfile: { verifiedAt: new Date() },
        }),
        update,
      },
    };
    const service = new AdminService({
      $transaction: (callback: (value: unknown) => Promise<unknown>) => callback(tx),
    } as unknown as PrismaService, crypto);
    await expect(
      service.moderateStore(admin, 'store', { status: 'ACTIVE', reason: 'Reviewed' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(update).not.toHaveBeenCalled();
  });

  it('cannot approve a listing belonging to an inactive store', async () => {
    const update = vi.fn();
    const tx = {
      listing: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'listing-1',
          status: 'PENDING_REVIEW',
          store: {
            status: 'DRAFT',
            sellerProfile: { verifiedAt: new Date() },
          },
        }),
        update,
      },
    };
    const service = new AdminService({
      $transaction: (callback: (value: unknown) => Promise<unknown>) => callback(tx),
    } as unknown as PrismaService, crypto);
    await expect(
      service.moderateListing(admin, 'listing', { status: 'ACTIVE', reason: 'Reviewed' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(update).not.toHaveBeenCalled();
  });
});
