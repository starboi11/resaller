import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config as loadEnvironment } from 'dotenv';
import { PrismaService } from '../infrastructure/prisma.service.js';
import { EndpointCryptoService } from '../notifications/endpoint-crypto.service.js';
import { SellerCenterService } from './seller-center.service.js';
import type { AuthenticatedUser } from '../auth/session.guard.js';

loadEnvironment({ path: '../../.env' });
if (process.env.RUN_DB_TESTS === '1' && process.env.DATABASE_URL) {
  const name = new URL(process.env.DATABASE_URL).pathname.slice(1);
  if (!name.endsWith('_e2e') && !(process.env.CI && name === 'ci'))
    throw new Error('Seller Center integration test requires an isolated *_e2e database');
}
const run = process.env.RUN_DB_TESTS === '1' && process.env.DATABASE_URL ? describe : describe.skip;

run('Seller Center shared-stock integration (PostgreSQL)', () => {
  const prisma = new PrismaService();
  const service = new SellerCenterService(prisma, new EndpointCryptoService());
  const tag = `selleros_${Date.now()}`;
  let user: AuthenticatedUser;
  let storeId = '';
  let storePublicId = '';
  let listingId = '';
  let variantId = '';

  beforeAll(async () => {
    await prisma.$connect();
    const seller = await prisma.user.create({ data: { username: `${tag}_seller`, passwordHash: 'test-only', roles: ['BUYER', 'SELLER'],
      sellerProfile: { create: { verifiedAt: new Date(), stores: { create: { username: `${tag}_store`, nameUz: 'SellerOS test',
        orderPrefix: `S${Date.now().toString().slice(-6)}`, status: 'ACTIVE' } } } } },
      include: { sellerProfile: { include: { stores: true } } } });
    user = { id: seller.id, publicId: seller.publicId, username: seller.username, roles: seller.roles, createdAt: seller.createdAt };
    storeId = seller.sellerProfile!.stores[0]!.id;
    storePublicId = seller.sellerProfile!.stores[0]!.publicId;
    const category = await prisma.category.upsert({ where: { slug: 'selleros-test' },
      create: { slug: 'selleros-test', nameUz: 'SellerOS test' }, update: {} });
    const listing = await prisma.listing.create({ data: { storeId, categoryId: category.id, nameUz: 'Test mahsulot',
      descriptionUz: 'Seller Center stock test', priceMinor: 10_000n, status: 'ACTIVE',
      variants: { create: { sku: `${tag}_sku`, options: {}, inventory: { create: { available: 1 } } } } },
      include: { variants: true } });
    listingId = listing.id;
    variantId = listing.variants[0]!.id;
  });

  afterAll(async () => {
    if (storeId) {
      const orders = await prisma.externalOrder.findMany({ where: { storeId }, select: { id: true } });
      const ids = orders.map((order) => order.id);
      await prisma.stockMovement.deleteMany({ where: { storeId } });
      await prisma.externalOrderHistory.deleteMany({ where: { externalOrderId: { in: ids } } });
      await prisma.externalOrderItem.deleteMany({ where: { externalOrderId: { in: ids } } });
      await prisma.externalOrder.deleteMany({ where: { storeId } });
      await prisma.storeCustomer.deleteMany({ where: { storeId } });
      await prisma.auditLog.deleteMany({ where: { actorId: user.id } });
      if (listingId) await prisma.listing.delete({ where: { id: listingId } });
      await prisma.store.delete({ where: { id: storeId } });
      await prisma.sellerProfile.delete({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await prisma.$disconnect();
  });

  it('reserves once, releases on cancellation, and consumes on delivery', async () => {
    const orderInput = (key: string) => ({ source: 'TELEGRAM', customerName: 'Test customer', customerPhone: '+998901234567',
      idempotencyKey: key, discountMinor: '0', deliveryCostMinor: '1000',
      items: [{ variantId, quantity: 1, unitPriceMinor: '10000', unitCostMinor: '5000' }] });
    const first = await service.createExternalOrder(user, storePublicId, orderInput(`${tag}_one`));
    const duplicate = await service.createExternalOrder(user, storePublicId, orderInput(`${tag}_one`));
    expect(duplicate).toEqual({ publicId: first.publicId, status: first.status, totalMinor: first.totalMinor, duplicate: true });
    await expect(service.createExternalOrder(user, storePublicId, orderInput(`${tag}_blocked`))).rejects.toThrow();
    expect(await prisma.inventory.findUnique({ where: { variantId } })).toMatchObject({ available: 0, reserved: 1 });
    await service.transition(user, storePublicId, first.publicId, { status: 'CANCELLED' });
    expect(await prisma.inventory.findUnique({ where: { variantId } })).toMatchObject({ available: 1, reserved: 0 });
    const second = await service.createExternalOrder(user, storePublicId, orderInput(`${tag}_two`));
    await service.transition(user, storePublicId, second.publicId, { status: 'CONFIRMED' });
    await service.transition(user, storePublicId, second.publicId, { status: 'PREPARING' });
    await service.transition(user, storePublicId, second.publicId, { status: 'READY' });
    await service.transition(user, storePublicId, second.publicId, { status: 'DELIVERED' });
    expect(await prisma.inventory.findUnique({ where: { variantId } })).toMatchObject({ available: 0, reserved: 0 });
    const report = await service.finance(user, storePublicId, 1);
    expect(report.externalRevenueMinor).toBe('10000');
    expect(report.costOfGoodsKnownMinor).toBe('5000');
    expect(report.netProfitEstimateExternalMinor).toBe('4000');
    await service.updatePaymentRecord(user, storePublicId, second.publicId, { status: 'REFUNDED', reason: 'Test refund record' });
    const refunded = await service.finance(user, storePublicId, 1);
    expect(refunded.externalRevenueMinor).toBe('0');
    expect(refunded.refundsMinor).toBe('10000');
    expect(refunded.netProfitEstimateExternalMinor).toBe('-6000');
  });
});
