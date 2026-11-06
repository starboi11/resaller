import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GoneException, NotFoundException } from '@nestjs/common';
import { config as loadEnvironment } from 'dotenv';
import { PrismaService } from '../infrastructure/prisma.service.js';
import { EndpointCryptoService } from '../notifications/endpoint-crypto.service.js';
import { CommerceService } from './commerce.service.js';
import { CommerceController } from './commerce.controller.js';
import { OperationsService } from '../operations/operations.service.js';
import type { AuthenticatedUser } from '../auth/session.guard.js';
import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { OwnerGuard } from '../owner/owner-access.js';
import { OwnerStoreCheck } from '../owner/owner-store-check.js';
import { SellerCenterService } from '../seller-center/seller-center.service.js';

loadEnvironment({ path: '../../.env' });
if (process.env.RUN_DB_TESTS === '1' && process.env.DATABASE_URL) {
  const name = new URL(process.env.DATABASE_URL).pathname.slice(1);
  if (!name.endsWith('_e2e') && !(process.env.CI && name === 'ci'))
    throw new Error('Owner-only integration test requires an isolated *_e2e database');
}
const run = process.env.RUN_DB_TESTS === '1' && process.env.DATABASE_URL ? describe : describe.skip;

// Owner decision 2026-11-03: only the owner sells. Another store that still
// exists in the database (old seller, demo data) must be invisible to buyers.
run('owner-only storefront (PostgreSQL)', () => {
  const prisma = new PrismaService();
  const commerce = new CommerceService(prisma, new EndpointCryptoService());
  const operations = new OperationsService(prisma);
  const tag = `own${Date.now().toString(36)}`;
  const previous = process.env.OWNER_STORE_USERNAME;
  let buyer: AuthenticatedUser;
  const people: Record<'owner' | 'other', AuthenticatedUser> = {} as never;
  const storeIds: Record<'owner' | 'other', string> = {} as never;
  const center = new SellerCenterService(prisma, new EndpointCryptoService());
  const guard = new OwnerGuard(prisma);
  // Builds the request the guard sees for a given route.
  const context = (user: AuthenticatedUser | undefined, url: string, params: Record<string, string> = {}) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ user, params, routeOptions: { url } }) }) }) as unknown as ExecutionContext;
  const listings: Record<'owner' | 'other', { publicId: string; variantId: string }> = {} as never;

  beforeAll(async () => {
    await prisma.$connect();
    const category = await prisma.category.upsert({ where: { slug: 'owner-only-test' }, create: { slug: 'owner-only-test', nameUz: 'Owner test' }, update: {} });
    for (const who of ['owner', 'other'] as const) {
      const user = await prisma.user.create({ data: { username: `${tag}_${who}`, passwordHash: 'test-only', roles: ['BUYER', 'SELLER'],
        sellerProfile: { create: { verifiedAt: who === 'owner' ? null : new Date(), stores: { create: { username: `${tag}_${who}`, nameUz: who, orderPrefix: `${who.slice(0, 2).toUpperCase()}${tag.slice(-6)}`, status: 'ACTIVE' } } } } },
        include: { sellerProfile: { include: { stores: true } } } });
      const listing = await prisma.listing.create({ data: { storeId: user.sellerProfile!.stores[0]!.id, categoryId: category.id, nameUz: `${tag} ${who} soat`,
        descriptionUz: 'Test', priceMinor: 100_000n, status: 'ACTIVE', variants: { create: { sku: `${tag}-${who}`, options: {}, inventory: { create: { available: 5 } } } } },
        include: { variants: true } });
      listings[who] = { publicId: listing.publicId, variantId: listing.variants[0]!.id };
      people[who] = { id: user.id, publicId: user.publicId, username: user.username, roles: ['BUYER', 'SELLER'], createdAt: user.createdAt } as AuthenticatedUser;
      storeIds[who] = user.sellerProfile!.stores[0]!.publicId;
    }
    const row = await prisma.user.create({ data: { username: `${tag}_buyer`, passwordHash: 'test-only' } });
    buyer = { id: row.id, publicId: row.publicId, username: row.username, roles: ['BUYER'], createdAt: row.createdAt } as AuthenticatedUser;
    process.env.OWNER_STORE_USERNAME = `${tag}_owner`;
  });

  afterAll(async () => {
    if (previous === undefined) delete process.env.OWNER_STORE_USERNAME;
    else process.env.OWNER_STORE_USERNAME = previous;
    await prisma.$disconnect();
  });

  it('shows only the owner listing in the catalogue and search', async () => {
    const page = await commerce.marketplace({ q: tag } as never);
    const ids = page.items.map((item) => item.publicId);
    expect(ids).toContain(listings.owner.publicId);
    expect(ids).not.toContain(listings.other.publicId);
  });

  it('ignores a retired seller-trust filter instead of emptying the page', async () => {
    const page = await commerce.marketplace({ q: tag, trust: 'TOP_SELLER' } as never);
    expect(page.items.map((item) => item.publicId)).toContain(listings.owner.publicId);
  });

  it('hides another store by direct link: product, store page and cart', async () => {
    await expect(commerce.getListing(listings.owner.publicId)).resolves.toMatchObject({ publicId: listings.owner.publicId });
    await expect(commerce.getListing(listings.other.publicId)).rejects.toBeInstanceOf(NotFoundException);
    await expect(commerce.getStore(`${tag}_other`)).rejects.toBeInstanceOf(NotFoundException);
    await expect(operations.addCartItem(buyer.id, { listingPublicId: listings.other.publicId, variantId: listings.other.variantId, quantity: 1 }))
      .rejects.toBeInstanceOf(NotFoundException);
    await expect(operations.addCartItem(buyer.id, { listingPublicId: listings.owner.publicId, variantId: listings.owner.variantId, quantity: 1 }))
      .resolves.toBeDefined();
  });

  it('refuses checkout of an item left in a cart from another store', async () => {
    const cart = await prisma.cart.findFirstOrThrow({ where: { buyerId: buyer.id } });
    await prisma.cartItem.create({ data: { cartId: cart.id, listingId: (await prisma.listing.findUniqueOrThrow({ where: { publicId: listings.other.publicId } })).id,
      variantId: listings.other.variantId, quantity: 1 } });
    await expect(operations.checkout(buyer, { idempotencyKey: `${tag}_mixed`, delivery: { fullName: 'Ali', phone: '+998901234567', region: 'Toshkent', address: 'Chilonzor 1' } } as never))
      .rejects.toThrow('Store is no longer open for orders');
    expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId: listings.other.variantId } })).toMatchObject({ available: 5, reserved: 0 });
  });

  it('a buyer cannot reach store management', async () => {
    await expect(commerce.ownerStatus(buyer.id)).resolves.toMatchObject({ isOwner: false, store: null });
    await expect(guard.canActivate(context(buyer, '/api/v1/seller/stores'))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard.canActivate(context(buyer, '/api/v1/seller-center/stores/:storeId/dashboard', { storeId: storeIds.owner })))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard.canActivate(context(undefined, '/api/v1/seller/stores'))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('an old SELLER account gets no owner rights, not even over its own store', async () => {
    await expect(commerce.ownerStatus(people.other.id)).resolves.toMatchObject({ isOwner: false });
    await expect(guard.canActivate(context(people.other, '/api/v1/seller/stores'))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard.canActivate(context(people.other, '/api/v1/seller-center/stores/:storeId/dashboard', { storeId: storeIds.other })))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard.canActivate(context(people.other, '/api/v1/listings/:publicId', { publicId: listings.other.publicId })))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('a former team member of the owner store gets no owner rights', async () => {
    // Teams are retired; a StoreMember row left over from before must not
    // become a back door into store management.
    const row = await prisma.user.create({ data: { username: `${tag}_member`, passwordHash: 'test-only', roles: ['BUYER', 'SELLER'] } });
    const member = { id: row.id, publicId: row.publicId, username: row.username, roles: ['BUYER', 'SELLER'], createdAt: row.createdAt } as AuthenticatedUser;
    const ownerStore = await prisma.store.findUniqueOrThrow({ where: { publicId: storeIds.owner } });
    for (const role of ['STORE_MANAGER', 'ORDER_OPERATOR'] as const) {
      await prisma.storeMember.deleteMany({ where: { storeId: ownerStore.id, userId: member.id } });
      await prisma.storeMember.create({ data: { storeId: ownerStore.id, userId: member.id, role } });
      await expect(commerce.ownerStatus(member.id)).resolves.toMatchObject({ isOwner: false, role: null, store: null });
      await expect(guard.canActivate(context(member, '/api/v1/seller/stores'))).rejects.toBeInstanceOf(ForbiddenException);
      await expect(guard.canActivate(context(member, '/api/v1/seller-center/stores/:storeId/dashboard', { storeId: storeIds.owner })))
        .rejects.toBeInstanceOf(ForbiddenException);
      await expect(guard.canActivate(context(member, '/api/v1/stores/:publicId/settings', { publicId: storeIds.owner })))
        .rejects.toBeInstanceOf(ForbiddenException);
      await expect(guard.canActivate(context(member, '/api/v1/listings/:publicId', { publicId: listings.owner.publicId })))
        .rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  it('the real owner manages the owner store without any ID verification', async () => {
    await expect(commerce.ownerStatus(people.owner.id)).resolves.toMatchObject({ isOwner: true, role: 'OWNER', store: { publicId: storeIds.owner } });
    await expect(guard.canActivate(context(people.owner, '/api/v1/seller/stores'))).resolves.toBe(true);
    await expect(guard.canActivate(context(people.owner, '/api/v1/seller-center/stores/:storeId/dashboard', { storeId: storeIds.owner }))).resolves.toBe(true);
    await expect(guard.canActivate(context(people.owner, '/api/v1/stores/:publicId/settings', { publicId: storeIds.owner }))).resolves.toBe(true);
    // ...but cannot be pointed at another store.
    await expect(guard.canActivate(context(people.owner, '/api/v1/stores/:publicId/settings', { publicId: storeIds.other })))
      .rejects.toBeInstanceOf(ForbiddenException);
    // Seller Center works although the owner's seller profile is not verified.
    await expect(center.dashboard(people.owner, storeIds.owner)).resolves.toBeDefined();
    // Publishing a product needs no verification either.
    const draft = await prisma.listing.create({ data: { storeId: (await prisma.store.findUniqueOrThrow({ where: { publicId: storeIds.owner } })).id,
      categoryId: (await prisma.category.findUniqueOrThrow({ where: { slug: 'owner-only-test' } })).id, nameUz: `${tag} yangi mahsulot`,
      descriptionUz: 'Yangi mahsulot tavsifi, kamida bir necha so‘z', priceMinor: 50_000n, status: 'DRAFT',
      variants: { create: { sku: `${tag}-new`, options: {}, inventory: { create: { available: 3 } } } },
      media: { create: { storageKey: `${'c'.repeat(40)}${tag.slice(-8).padStart(8, '0')}.webp`, mimeType: 'image/webp', position: 0 } } } });
    const published = await commerce.submitListing(people.owner, draft.publicId) as { status?: string };
    expect(['ACTIVE', 'PENDING_REVIEW']).toContain(published.status);
  });

  it('refuses to start in production when OWNER_STORE_USERNAME names no real store', async () => {
    const env = { owner: process.env.OWNER_STORE_USERNAME, node: process.env.NODE_ENV };
    process.env.OWNER_STORE_USERNAME = `${tag}_typo`;
    process.env.NODE_ENV = 'production';
    try {
      await expect(new OwnerStoreCheck(prisma).onApplicationBootstrap()).rejects.toThrow(/OWNER_STORE_USERNAME/);
    } finally {
      process.env.OWNER_STORE_USERNAME = env.owner;
      process.env.NODE_ENV = env.node;
    }
    await expect(new OwnerStoreCheck(prisma).onApplicationBootstrap()).resolves.toBeUndefined();
  });

  it('answers closed seller-signup endpoints with 410 Gone', () => {
    const controller = new CommerceController(commerce);
    const request = { user: buyer } as never;
    expect(() => controller.apply(request)).toThrow(GoneException);
    expect(() => controller.verification(request, {} as never)).toThrow(GoneException);
  });
});
