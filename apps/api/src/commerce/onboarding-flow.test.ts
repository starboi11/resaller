import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../infrastructure/prisma.service.js';
import { CommerceService } from './commerce.service.js';
import { EndpointCryptoService } from '../notifications/endpoint-crypto.service.js';

const seller = { id: 'seller-1' } as never;
const crypto = new EndpointCryptoService();

function storeFixture(overrides: Record<string, unknown> = {}) {
  const store = {
    id: 'store-1',
    status: 'DRAFT',
    sellerProfile: {
      userId: 'seller-1',
      verifiedAt: new Date(),
      verification: { status: 'APPROVED', documentStorageKey: 'document.pdf' },
    },
    ...overrides,
  };
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const createAudit = vi.fn().mockResolvedValue({});
  const prisma = {
    store: { findUnique: vi.fn().mockResolvedValue(store) },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({ store: { updateMany }, auditLog: { create: createAudit } })),
  };
  return {
    service: new CommerceService(prisma as unknown as PrismaService, crypto),
    updateMany,
    createAudit,
  };
}

describe('seller identity gate and self-service publication', () => {
  it('encrypts seller contact and document number before saving', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 'verification-1' });
    const service = new CommerceService({
      sellerProfile: { findUnique: vi.fn().mockResolvedValue({ id: 'profile-1', verifiedAt: null }) },
      sellerVerification: { findUnique: vi.fn().mockResolvedValue(null), upsert },
    } as unknown as PrismaService, crypto);
    await service.submitVerification('seller-1', {
      legalName: 'Seller One', documentType: 'ID_CARD', documentNumber: 'aa1234567',
      phone: '+998901234567', residenceAddress: 'Toshkent shahri, Yunusobod tumani',
    });
    const data = upsert.mock.calls[0]![0].create;
    expect(data.documentNumberMasked).toBe('*****4567');
    expect(data.phoneMasked).toBe('+998*****4567');
    expect(data.documentNumberEncrypted).not.toContain('AA1234567');
    expect(crypto.decrypt(data.documentNumberEncrypted)).toBe('AA1234567');
    expect(crypto.decrypt(data.phoneEncrypted)).toBe('+998901234567');
    expect(crypto.decrypt(data.residenceAddressEncrypted)).toBe('Toshkent shahri, Yunusobod tumani');
  });

  it('rejects malformed identity document series', async () => {
    const upsert = vi.fn();
    const service = new CommerceService({
      sellerProfile: { findUnique: vi.fn().mockResolvedValue({ id: 'profile-1', verifiedAt: null }) },
      sellerVerification: { findUnique: vi.fn().mockResolvedValue(null), upsert },
    } as unknown as PrismaService, crypto);
    await expect(service.submitVerification('seller-1', {
      legalName: 'Seller One', documentType: 'PASSPORT', documentNumber: 'ABC',
      phone: '+998901234567', residenceAddress: 'Toshkent shahri, Yunusobod tumani',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(upsert).not.toHaveBeenCalled();
  });
  it('does not let a verified seller reset identity review through the ordinary form', async () => {
    const upsert = vi.fn();
    const service = new CommerceService({
      sellerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'profile-1', verifiedAt: new Date() }),
      },
      sellerVerification: { upsert },
    } as unknown as PrismaService, crypto);
    await expect(
      service.submitVerification('seller-1', {
        legalName: 'Seller One',
        documentType: 'ID_CARD',
        documentNumber: 'AB123456',
        phone: '+998901234567',
        residenceAddress: 'Toshkent shahri, Yunusobod',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('activates an identity-verified draft and records an audit event', async () => {
    const { service, updateMany, createAudit } = storeFixture();
    await expect(service.submitStore(seller, 'public-store')).resolves.toEqual({
      publicId: 'public-store',
      status: 'ACTIVE',
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'store-1', status: 'DRAFT' },
      data: { status: 'ACTIVE' },
    });
    expect(createAudit).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'STORE_ACTIVATED_BY_SELLER' }) });
  });

  it('denies another seller and an unverified owner', async () => {
    const other = storeFixture({
      sellerProfile: { userId: 'other', verifiedAt: new Date() },
    });
    await expect(other.service.submitStore(seller, 'store')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(other.updateMany).not.toHaveBeenCalled();

    const unverified = storeFixture({
      sellerProfile: {
        userId: 'seller-1',
        verifiedAt: null,
        verification: { status: 'DOCUMENT_REQUIRED', documentStorageKey: null },
      },
    });
    await expect(unverified.service.submitStore(seller, 'store')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(unverified.updateMany).not.toHaveBeenCalled();
  });

  it('does not activate the same store twice', async () => {
    const { service, updateMany } = storeFixture({ status: 'ACTIVE' });
    await expect(service.submitStore(seller, 'store')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('does not publish a listing while its store is still a draft', async () => {
    const updateMany = vi.fn();
    const prisma = {
      listing: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'listing-1',
          status: 'DRAFT',
          store: {
            status: 'DRAFT',
            sellerProfile: { userId: 'seller-1', verifiedAt: new Date() },
            members: [],
          },
          media: [{}],
          variants: [{ inventory: { available: 2 } }],
        }),
        updateMany,
      },
    };
    const service = new CommerceService(prisma as unknown as PrismaService, crypto);
    await expect(service.submitListing(seller, 'listing')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('publishes a stocked listing with media without a second admin decision', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const createAudit = vi.fn();
    const service = new CommerceService({
      listing: { findUnique: vi.fn().mockResolvedValue({
        id: 'listing-1', status: 'DRAFT',
        store: { status: 'ACTIVE', sellerProfile: { userId: 'seller-1', verifiedAt: new Date() }, members: [] },
        media: [{}], variants: [{ inventory: { available: 2 } }],
      }) },
      $transaction: (callback: (tx: unknown) => Promise<unknown>) => callback({ listing: { updateMany }, auditLog: { create: createAudit } }),
    } as unknown as PrismaService, crypto);
    await expect(service.submitListing(seller, 'listing')).resolves.toEqual({ publicId: 'listing', status: 'ACTIVE' });
    expect(updateMany).toHaveBeenCalledWith({ where: { id: 'listing-1', status: { in: ['DRAFT', 'REJECTED'] } }, data: { status: 'ACTIVE' } });
    expect(createAudit).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'LISTING_PUBLISHED_BY_SELLER' }) });
  });
});
