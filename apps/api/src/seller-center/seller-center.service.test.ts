import { describe, expect, it, vi } from 'vitest';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { SellerCenterService } from './seller-center.service.js';
import type { AuthenticatedUser } from '../auth/session.guard.js';
import type { PrismaService } from '../infrastructure/prisma.service.js';
import type { EndpointCryptoService } from '../notifications/endpoint-crypto.service.js';

const user: AuthenticatedUser = { id: 'user-1', publicId: 'public-user', username: 'seller', roles: [], createdAt: new Date() };
const store = (role: string, verified = true) => ({ id: 'store-1', publicId: 'store-public', username: 'shop', nameUz: 'Shop',
  status: 'ACTIVE', sellerProfile: { userId: 'owner-1', verifiedAt: verified ? new Date() : null }, members: [{ role }] });

describe('Seller Center authorization and stock safety', () => {
  it('denies finance to order operators', async () => {
    const prisma = { store: { findUnique: vi.fn().mockResolvedValue(store('ORDER_OPERATOR')) } };
    const service = new SellerCenterService(prisma as unknown as PrismaService, {} as EndpointCryptoService);
    await expect(service.finance(user, 'store-public')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies unverified sellers even when they are members', async () => {
    const prisma = { store: { findUnique: vi.fn().mockResolvedValue(store('STORE_MANAGER', false)) } };
    const service = new SellerCenterService(prisma as unknown as PrismaService, {} as EndpointCryptoService);
    await expect(service.inventory(user, 'store-public')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns an idempotent external order without reserving stock twice', async () => {
    const transaction = vi.fn();
    const prisma = { store: { findUnique: vi.fn().mockResolvedValue(store('STORE_MANAGER')) },
      externalOrder: { findUnique: vi.fn().mockResolvedValue({ publicId: 'existing-order', status: 'NEW', totalMinor: 20_000n }) }, $transaction: transaction };
    const service = new SellerCenterService(prisma as unknown as PrismaService, {} as EndpointCryptoService);
    const result = await service.createExternalOrder(user, 'store-public', { idempotencyKey: 'same-request', items: [] } as never);
    // A replay answers with the same shape as the original create.
    expect(result).toEqual({ publicId: 'existing-order', status: 'NEW', totalMinor: '20000', duplicate: true });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('reserves shared inventory and writes an immutable order snapshot in one transaction', async () => {
    const tx = { listingVariant: { findMany: vi.fn().mockResolvedValue([{ id: 'variant-1', sku: 'SKU-1', options: { size: 'M' },
      listing: { publicId: 'listing-1', nameUz: 'Kiyim', categoryId: 'category-1' } }]) },
      storeCustomer: { upsert: vi.fn().mockResolvedValue({ id: 'customer-1' }) },
      inventory: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      externalOrder: { create: vi.fn().mockResolvedValue({ id: 'order-1', publicId: 'order-public', status: 'NEW', totalMinor: 20_000n }) },
      stockMovement: { create: vi.fn() }, auditLog: { create: vi.fn() } };
    const prisma = { store: { findUnique: vi.fn().mockResolvedValue(store('STORE_MANAGER')) },
      externalOrder: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (transaction: unknown) => Promise<unknown>) => callback(tx)) };
    const crypto = { encrypt: vi.fn((value: string) => `encrypted:${value}`) };
    const service = new SellerCenterService(prisma as unknown as PrismaService, crypto as unknown as EndpointCryptoService);
    const result = await service.createExternalOrder(user, 'store-public', { source: 'TELEGRAM', customerName: 'Ali',
      customerPhone: '+998901234567', idempotencyKey: 'unique-request', items: [{ variantId: 'variant-1', quantity: 2,
        unitPriceMinor: '10000', unitCostMinor: '5000' }], discountMinor: '0', deliveryCostMinor: '1000' });
    expect(result).toEqual({ publicId: 'order-public', status: 'NEW', totalMinor: '20000', duplicate: false });
    expect(tx.inventory.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { variantId: 'variant-1', available: { gte: 2 } },
      data: expect.objectContaining({ available: { decrement: 2 }, reserved: { increment: 2 } }) }));
    expect(tx.externalOrder.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      source: 'TELEGRAM', subtotalMinor: 20_000n, costOfGoodsMinor: 10_000n,
      items: { create: [expect.objectContaining({ snapshot: expect.objectContaining({ listingName: 'Kiyim', sku: 'SKU-1' }) })] },
    }) }));
    expect(tx.stockMovement.create).toHaveBeenCalledOnce();
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
  });

  it('releases reserved stock exactly once on cancellation', async () => {
    const tx = { externalOrder: { findFirst: vi.fn().mockResolvedValue({ id: 'order-1', publicId: 'order-public', status: 'NEW',
      items: [{ variantId: 'variant-1', quantity: 2 }] }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      inventory: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) }, stockMovement: { create: vi.fn() },
      externalOrderHistory: { create: vi.fn() }, auditLog: { create: vi.fn() } };
    const prisma = { store: { findUnique: vi.fn().mockResolvedValue(store('STORE_MANAGER')) },
      $transaction: vi.fn(async (callback: (transaction: unknown) => Promise<unknown>) => callback(tx)) };
    const service = new SellerCenterService(prisma as unknown as PrismaService, {} as EndpointCryptoService);
    await expect(service.transition(user, 'store-public', 'order-public', { status: 'CANCELLED' })).resolves.toEqual({
      publicId: 'order-public', status: 'CANCELLED', unchanged: false,
    });
    expect(tx.inventory.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { variantId: 'variant-1', reserved: { gte: 2 } }, data: expect.objectContaining({ available: { increment: 2 }, reserved: { decrement: 2 } }),
    }));
    expect(tx.stockMovement.create).toHaveBeenCalledOnce();
  });

  it('rejects cancellation after shipping before changing inventory', async () => {
    const tx = { externalOrder: { findFirst: vi.fn().mockResolvedValue({ id: 'order-1', publicId: 'order-public', status: 'SHIPPED', items: [] }),
      updateMany: vi.fn() }, inventory: { updateMany: vi.fn() } };
    const prisma = { store: { findUnique: vi.fn().mockResolvedValue(store('STORE_MANAGER')) },
      $transaction: vi.fn(async (callback: (transaction: unknown) => Promise<unknown>) => callback(tx)) };
    const service = new SellerCenterService(prisma as unknown as PrismaService, {} as EndpointCryptoService);
    await expect(service.transition(user, 'store-public', 'order-public', { status: 'CANCELLED' })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.externalOrder.updateMany).not.toHaveBeenCalled();
    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
  });
});
