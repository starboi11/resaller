import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config as loadEnvironment } from 'dotenv';
import { PrismaService } from '../infrastructure/prisma.service.js';
import { OperationsService } from './operations.service.js';

loadEnvironment({ path: '../../.env' });
const run = process.env.DATABASE_URL ? describe : describe.skip;

run('checkout concurrency (PostgreSQL)', () => {
  const prisma = new PrismaService();
  const operations = new OperationsService(prisma);
  const tag = `concurrency_${Date.now()}`;
  const userIds: string[] = [];
  let storeId = '';
  let listingId = '';

  beforeAll(async () => {
    await prisma.$connect();
    const seller = await prisma.user.create({
      data: {
        username: `${tag}_seller`,
        passwordHash: 'test-only',
        roles: ['BUYER', 'SELLER'],
        sellerProfile: {
          create: {
            verifiedAt: new Date(),
            stores: {
              create: {
                username: `${tag}_store`,
                nameUz: 'Concurrency Store',
                orderPrefix: `C${Date.now().toString().slice(-6)}`,
                status: 'ACTIVE',
              },
            },
          },
        },
      },
      include: { sellerProfile: { include: { stores: true } } },
    });
    userIds.push(seller.id);
    storeId = seller.sellerProfile!.stores[0]!.id;
    const category = await prisma.category.upsert({
      where: { slug: 'concurrency-test' },
      create: { slug: 'concurrency-test', nameUz: 'Concurrency test' },
      update: {},
    });
    const listing = await prisma.listing.create({
      data: {
        storeId,
        categoryId: category.id,
        nameUz: 'Last stock',
        descriptionUz: 'Concurrency integration test listing',
        priceMinor: 10_000n,
        status: 'ACTIVE',
        variants: {
          create: {
            sku: `${tag}_sku`,
            options: {},
            inventory: { create: { available: 1 } },
          },
        },
      },
      include: { variants: true },
    });
    listingId = listing.id;
    for (let index = 0; index < 2; index += 1) {
      const buyer = await prisma.user.create({
        data: { username: `${tag}_buyer_${index}`, passwordHash: 'test-only' },
      });
      userIds.push(buyer.id);
      await prisma.cart.create({
        data: {
          buyerId: buyer.id,
          items: {
            create: {
              listingId,
              variantId: listing.variants[0]!.id,
              quantity: 1,
            },
          },
        },
      });
    }
  });

  afterAll(async () => {
    const orders = await prisma.order.findMany({
      where: { buyerId: { in: userIds } },
      select: { id: true },
    });
    const orderIds = orders.map((order) => order.id);
    await prisma.notification.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.conversationMember.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.orderStatusHistory.deleteMany({
      where: { orderId: { in: orderIds } },
    });
    await prisma.stockReservation.deleteMany({
      where: { orderId: { in: orderIds } },
    });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.conversation.deleteMany({
      where: { orderId: { in: orderIds } },
    });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.checkout.deleteMany({ where: { buyerId: { in: userIds } } });
    await prisma.cartItem.deleteMany({
      where: { cart: { buyerId: { in: userIds } } },
    });
    await prisma.cart.deleteMany({ where: { buyerId: { in: userIds } } });
    await prisma.listing.deleteMany({ where: { id: listingId } });
    await prisma.store.deleteMany({ where: { id: storeId } });
    await prisma.sellerProfile.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it('allows only one buyer to reserve the final unit', async () => {
    const buyers = await prisma.user.findMany({
      where: { id: { in: userIds.slice(1) } },
    });
    const results = await Promise.allSettled(
      buyers.map((buyer, index) =>
        operations.checkout(
          { ...buyer, roles: buyer.roles },
          { idempotencyKey: `${tag}_${index}`, delivery: { method: 'pickup' } },
        ),
      ),
    );
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    const inventory = await prisma.inventory.findFirstOrThrow({
      where: { variant: { listingId } },
    });
    expect(inventory.available).toBe(0);
    expect(inventory.reserved).toBe(1);
  });
});
