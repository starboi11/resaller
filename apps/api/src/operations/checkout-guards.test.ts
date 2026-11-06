import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { OperationsService } from './operations.service.js';
import type { PrismaService } from '../infrastructure/prisma.service.js';
import type { AuthenticatedUser } from '../auth/session.guard.js';
import type { CheckoutDto } from './operations.dto.js';

const user: AuthenticatedUser = { id: 'buyer-1', publicId: 'public-buyer', username: 'buyer', roles: ['BUYER'], createdAt: new Date() };

const store = (overrides: Record<string, unknown> = {}) => ({
  publicId: 'store-public', username: 'shop', nameUz: 'Shop', orderPrefix: 'SH',
  kind: 'SELLER', status: 'ACTIVE', vacationMode: false,
  sellerProfile: { userId: 'seller-1' }, policies: [],
  ...overrides,
});

const cartItem = (listing: Record<string, unknown> = {}, storeOverrides: Record<string, unknown> = {}) => ({
  id: 'cart-item-1', variantId: 'variant-1', quantity: 2,
  listing: {
    id: 'listing-1', publicId: 'listing-1', nameUz: 'Mahsulot', categoryId: 'category-1',
    priceMinor: 10_000n, storeId: 'store-1', status: 'ACTIVE', deletedAt: null, sourceListingId: null, sourceListing: null, markupBps: null,
    store: store(storeOverrides),
    variants: [{ id: 'variant-1', sku: 'SKU-1', options: {}, priceOverrideMinor: null, inventory: { available: 10, reserved: 0 } }],
    ...listing,
  },
});

function harness(items: ReturnType<typeof cartItem>[]) {
  const tx = {
    cart: { findUnique: vi.fn().mockResolvedValue({ id: 'cart-1', items }) },
    checkout: { create: vi.fn().mockResolvedValue({ id: 'checkout-1', publicId: 'checkout-public' }) },
    inventory: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    coupon: { findUnique: vi.fn().mockResolvedValue(null) },
    couponRedemption: { count: vi.fn().mockResolvedValue(0), create: vi.fn() },
    order: { create: vi.fn().mockResolvedValue({ id: 'order-1', publicId: 'order-public', displayId: 'SH-1', status: 'WAITING_SELLER', totalMinor: 20_000n, sellerAcceptBy: new Date() }) },
    notification: { create: vi.fn() },
    resellerEarning: { create: vi.fn() },
    cartItem: { deleteMany: vi.fn() },
    savedAddress: { create: vi.fn(), count: vi.fn().mockResolvedValue(0) },
  };
  const prisma = {
    checkout: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn(async (callback: (transaction: unknown) => Promise<unknown>) => callback(tx)),
  };
  return { tx, prisma, service: new OperationsService(prisma as unknown as PrismaService) };
}

const input = (overrides: Partial<CheckoutDto> = {}): CheckoutDto =>
  ({ idempotencyKey: 'checkout-request-1', delivery: { fullName: 'Ali', phone: '+998901234567', region: 'Toshkent', address: 'Chilonzor 1' }, ...overrides }) as CheckoutDto;

describe('checkout re-validates purchasability inside the reserving transaction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('completes a normal checkout', async () => {
    const { service, tx } = harness([cartItem()]);
    const result = await service.checkout(user, input());
    expect(result).toMatchObject({ checkoutPublicId: 'checkout-public' });
    expect(tx.inventory.updateMany).toHaveBeenCalledOnce();
    expect(tx.cartItem.deleteMany).toHaveBeenCalledOnce();
  });

  it('refuses a store that stopped being ACTIVE after the item was added', async () => {
    const { service, tx } = harness([cartItem({}, { status: 'SUSPENDED' })]);
    await expect(service.checkout(user, input())).rejects.toBeInstanceOf(ConflictException);
    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('refuses a store that switched on vacation mode', async () => {
    const { service, tx } = harness([cartItem({}, { vacationMode: true })]);
    await expect(service.checkout(user, input())).rejects.toBeInstanceOf(ConflictException);
    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
  });

  it('refuses a listing that was unpublished after the item was added', async () => {
    const { service, tx } = harness([cartItem({ status: 'PAUSED' })]);
    await expect(service.checkout(user, input())).rejects.toBeInstanceOf(ConflictException);
    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
  });

  it('refuses a soft-deleted listing', async () => {
    const { service, tx } = harness([cartItem({ deletedAt: new Date() })]);
    await expect(service.checkout(user, input())).rejects.toBeInstanceOf(ConflictException);
    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
  });

  it('refuses to charge a total the buyer was not shown', async () => {
    const { service, tx } = harness([cartItem()]);
    await expect(service.checkout(user, input({ expectedTotalMinor: { 'store-public': '15000' } })))
      .rejects.toBeInstanceOf(ConflictException);
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('accepts a total that still matches what the buyer confirmed', async () => {
    const { service, tx } = harness([cartItem()]);
    await service.checkout(user, input({ expectedTotalMinor: { 'store-public': '20000' } }));
    expect(tx.order.create).toHaveBeenCalledOnce();
  });

  it('replays the winning checkout when two submissions race on one idempotency key', async () => {
    const { service, prisma } = harness([cartItem()]);
    prisma.$transaction.mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }));
    prisma.checkout.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      buyerId: user.id, publicId: 'checkout-public', orders: [{ publicId: 'order-public', displayId: 'SH-1', status: 'WAITING_SELLER' }],
    });
    await expect(service.checkout(user, input())).resolves.toEqual({
      checkoutPublicId: 'checkout-public',
      orders: [{ publicId: 'order-public', displayId: 'SH-1', status: 'WAITING_SELLER' }],
    });
  });

  it('never replays another buyer checkout', async () => {
    const { service, prisma } = harness([cartItem()]);
    prisma.checkout.findUnique.mockResolvedValueOnce({buyerId:'another-buyer',publicId:'private-checkout',orders:[]});
    await expect(service.checkout(user, input())).rejects.toThrow('Checkout access denied');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('checks buyer ownership when replaying a concurrent checkout', async () => {
    const { service, prisma } = harness([cartItem()]);
    prisma.$transaction.mockRejectedValueOnce(Object.assign(new Error('unique'), {code:'P2002'}));
    prisma.checkout.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({buyerId:'another-buyer',publicId:'private-checkout',orders:[]});
    await expect(service.checkout(user,input())).rejects.toThrow('Checkout access denied');
  });

  it('retries a rolled-back serialization conflict without changing the idempotency key', async () => {
    const { service, prisma } = harness([cartItem()]);
    prisma.$transaction.mockRejectedValueOnce(Object.assign(new Error('could not serialize'), { code: 'P2034' }));
    await expect(service.checkout(user, input())).resolves.toMatchObject({checkoutPublicId:'checkout-public'});
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.checkout.findUnique).toHaveBeenNthCalledWith(2, {where:{idempotencyKey:'checkout-request-1'},include:{orders:true}});
  });

  it('reports a serialization failure as a retryable conflict, not a server error', async () => {
    const { service, prisma } = harness([cartItem()]);
    prisma.$transaction.mockRejectedValue(Object.assign(new Error('could not serialize'), { code: 'P2034' }));
    await expect(service.checkout(user, input())).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });
});
