import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../infrastructure/prisma.service.js';
import type { AuthenticatedUser } from '../auth/session.guard.js';
import {
  buyerCanCancelDirectly,
  canTransitionOrder,
  sellerAcceptBy,
  type OrderState,
} from '../orders/order-policy.js';
import { PLATFORM_BUSINESS_RULES } from '@resaller/types';
import type {
  AddCartItemDto,
  CheckoutDto,
  LocationMessageDto,
  QuestionDto,
  ReviewDto,
  SavedAddressDto,
} from './operations.dto.js';
import type { Prisma } from '../generated/prisma/client.js';
import { couponDiscount } from './coupon-policy.js';
import { isUniqueViolation, isSerializationFailure, mapSerializationFailure } from '../common/prisma-errors.js';
import {
  earningAmount,
  inventoryVariantId,
  isMarkupAllowed,
  markupWindow,
  resellerUnitPrice,
  wholesaleUnitPrice,
} from '../resale/resale-pricing.js';
import { syncResellerEarning } from '../resale/resale-sync.js';
import { isOwnerStore } from '../resale/resale-visibility.js';

type StoreParty = { sellerProfile: { userId: string }; members: { userId: string }[] };
const isStoreParty = (store: StoreParty | null | undefined, userId: string) =>
  !!store && store.sellerProfile.userId === userId;
/**
 * Who acts as "the seller" for an order. A resale order is fulfilled (accepted,
 * shipped, cancelled, returned) by the supplier store; the reseller store keeps
 * the buyer relationship (chat, reviews) but cannot drive fulfilment.
 */
const orderParties = (
  order: { store: StoreParty; fulfillmentStore?: StoreParty | null },
  userId: string,
) => {
  const reseller = isStoreParty(order.store, userId);
  const fulfiller = order.fulfillmentStore ? isStoreParty(order.fulfillmentStore, userId) : reseller;
  return { reseller, fulfiller, anySeller: reseller || fulfiller,
    fulfilmentOwnerId: (order.fulfillmentStore ?? order.store).sellerProfile.userId };
};
const partyStoreInclude = { include: { sellerProfile: true, members: true } } as const;
/** OrderItem columns that only the platform may see. */
const publicOrderItem = <T extends { supplierVariantId?: unknown; supplierUnitPriceMinor?: unknown; resellerMarginMinor?: unknown }>(item: T) => {
  const { supplierVariantId: _v, supplierUnitPriceMinor: _w, resellerMarginMinor: _m, ...rest } = item;
  return rest;
};


const serializeCart = (cart: any) => ({
  ...cart,
  items: cart.items.map((item: any) => ({
    ...item,
    listing: {
      ...item.listing,
      priceMinor: item.listing.priceMinor.toString(),
    },
  })),
});

@Injectable()
export class OperationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** A resale listing can be bought only while its supplier listing is on sale and the markup is inside the supplier window. */
  private resaleSourceOpen(listing: {
    markupBps: number | null;
    sourceListing: null | { status: string; deletedAt: Date | null; minMarkupBps: number | null; maxMarkupBps: number | null;
      store: { kind: string; status: string; vacationMode: boolean } };
  }) {
    const source = listing.sourceListing;
    return !!source && source.status === 'ACTIVE' && !source.deletedAt && source.store.kind === 'SUPPLIER'
      && source.store.status === 'ACTIVE' && !source.store.vacationMode
      && listing.markupBps !== null && isMarkupAllowed(listing.markupBps, markupWindow(source));
  }

  addresses(userId: string) {
    return this.prisma.savedAddress.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }] });
  }

  async saveAddress(userId: string, input: SavedAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      if (input.isDefault) await tx.savedAddress.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.savedAddress.create({ data: { userId, ...input } });
    });
  }

  async removeAddress(userId: string, publicId: string) {
    const result = await this.prisma.savedAddress.deleteMany({ where: { userId, publicId } });
    if (!result.count) throw new NotFoundException('Address not found');
    return { removed: true };
  }

  async cart(userId: string) {
    await this.prisma.cart.createMany({ data: [{ buyerId: userId }], skipDuplicates: true });
    const cart = await this.prisma.cart.findUniqueOrThrow({
      where: { buyerId: userId },
      include: {
        items: {
          include: {
            listing: {
              select: {
                publicId: true,
                nameUz: true,
                priceMinor: true,
                currency: true,
                storeId: true,
                store: { select: { publicId: true, nameUz: true } },
              },
            },
          },
        },
      },
    });
    return serializeCart(cart);
  }

  async addCartItem(userId: string, input: AddCartItemDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { publicId: input.listingPublicId },
      include: {
        variants: {
          where: { id: input.variantId },
          include: { inventory: true, sourceVariant: { include: { inventory: true } } },
        },
        store: true,
        sourceListing: { include: { store: true } },
      },
    });
    if (
      !listing ||
      listing.status !== 'ACTIVE' ||
      listing.deletedAt ||
      listing.store.status !== 'ACTIVE' ||
      listing.store.kind !== 'SELLER' ||
      listing.sourceListingId ||
      !isOwnerStore(listing.store)
    )
      throw new NotFoundException('Active listing not found');
    if (listing.sourceListingId && !this.resaleSourceOpen(listing))
      throw new ConflictException('Mahsulot hozir sotuvda emas');
    const variant = listing.variants[0];
    const inventory = variant?.sourceVariantId ? variant.sourceVariant?.inventory : variant?.inventory;
    if (!inventory || inventory.available < input.quantity)
      throw new ConflictException('Insufficient stock');
    const cart = await this.prisma.cart.upsert({
      where: { buyerId: userId },
      create: { buyerId: userId },
      update: {},
    });
    await this.prisma.cartItem.upsert({
      where: {
        cartId_variantId: { cartId: cart.id, variantId: input.variantId },
      },
      create: {
        cartId: cart.id,
        listingId: listing.id,
        variantId: input.variantId,
        quantity: input.quantity,
      },
      update: { quantity: input.quantity },
    });
    return this.cart(userId);
  }

  async updateCartItem(userId: string, id: string, quantity: number) {
    const item = await this.prisma.cartItem.findFirst({
      where: { id, cart: { buyerId: userId } },
      include: { variant: { include: { inventory: true, sourceVariant: { include: { inventory: true } } } } },
    });
    if (!item) throw new NotFoundException('Cart item not found');
    const inventory = item.variant.sourceVariantId ? item.variant.sourceVariant?.inventory : item.variant.inventory;
    if (!inventory || inventory.available < quantity)
      throw new ConflictException('Insufficient stock');
    await this.prisma.cartItem.update({ where: { id }, data: { quantity } });
    return this.cart(userId);
  }

  async removeCartItem(userId: string, id: string) {
    const result = await this.prisma.cartItem.deleteMany({
      where: { id, cart: { buyerId: userId } },
    });
    if (!result.count) throw new NotFoundException('Cart item not found');
    return this.cart(userId);
  }

  async buyerOrders(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { buyerId: userId },
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        store: { select: { username: true, nameUz: true } },
        items: {
          select: { quantity: true, unitPriceMinor: true, snapshot: true },
        },
        history: { orderBy: { createdAt: 'asc' } },
      },
    });
    return orders.map(({ fulfillmentStoreId: _f, ...order }) => ({
      ...order,
      totalMinor: order.totalMinor.toString(),
      subtotalMinor: order.subtotalMinor.toString(),
      discountMinor: order.discountMinor.toString(),
      items: order.items.map((item) => ({
        ...item,
        unitPriceMinor: item.unitPriceMinor.toString(),
      })),
    }));
  }

  async order(user: AuthenticatedUser, publicId: string) {
    const order = await this.prisma.order.findUnique({
      where: { publicId },
      include: {
        store: {
          select: {
            publicId: true,
            username: true,
            nameUz: true,
            sellerProfile: { select: { userId: true } },
            members: { select: { userId: true } },
          },
        },
        fulfillmentStore: {
          select: { sellerProfile: { select: { userId: true } }, members: { select: { userId: true } } },
        },
        items: true,
        history: { orderBy: { createdAt: 'asc' } },
        dispute: { include: { events: true, decision: true } },
        review: true,
        changes: { orderBy: { createdAt: 'asc' } },
        policySnapshots: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    const parties = orderParties(order, user.id);
    const admin = user.roles.some((role) =>
      ['SUPER_ADMIN', 'DISPUTE_ADMIN', 'SUPPORT_ADMIN'].includes(role),
    );
    const canView = order.buyerId === user.id || parties.anySeller || admin;
    if (!canView) throw new ForbiddenException('Order access denied');
    const { fulfillmentStore: _fulfillmentStore, fulfillmentStoreId, ...rest } = order;
    // Wholesale price and margin are visible to the platform side only:
    // the fulfilling supplier, the reseller who earns it, and admins.
    const seesResale = order.buyerId !== user.id && (parties.anySeller || admin);
    return {
      ...rest,
      viewerId: user.id,
      viewerRole: order.buyerId === user.id ? 'BUYER' : 'SELLER',
      fulfilment: fulfillmentStoreId ? 'SUPPLIER' : 'STORE',
      canFulfil: order.buyerId !== user.id && parties.fulfiller,
      // Order chat is between the buyer and the selling store; a supplier that
      // only ships the order has no access to it.
      canChat: order.buyerId === user.id || parties.reseller || admin,
      totalMinor: order.totalMinor.toString(),
      subtotalMinor: order.subtotalMinor.toString(),
      discountMinor: order.discountMinor.toString(),
      items: order.items.map((item) => {
        const base = { ...publicOrderItem(item), unitPriceMinor: item.unitPriceMinor.toString() };
        return seesResale && item.supplierVariantId
          ? { ...base, supplierUnitPriceMinor: item.supplierUnitPriceMinor!.toString(), resellerMarginMinor: item.resellerMarginMinor!.toString() }
          : base;
      }),
    };
  }

  async sellerOrders(userId: string) {
    const mine = { sellerProfile: { userId } };
    const orders = await this.prisma.order.findMany({
      where: { OR: [{ store: mine }, { fulfillmentStore: mine }] },
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        store: { select: { publicId: true, username: true, nameUz: true, sellerProfile: { select: { userId: true } }, members: { select: { userId: true } } } },
        fulfillmentStore: { select: { publicId: true, nameUz: true, sellerProfile: { select: { userId: true } }, members: { select: { userId: true } } } },
        items: {
          select: { quantity: true, unitPriceMinor: true, snapshot: true },
        },
      },
    });
    return orders.map(({ fulfillmentStore, fulfillmentStoreId: _f, store: { sellerProfile: _p, members: _m, ...store }, ...order }) => ({
      ...order,
      store,
      fulfilment: fulfillmentStore ? 'SUPPLIER' : 'STORE',
      // FULFILLER ships the order; RESELLER only follows it and talks to the buyer.
      myRole: !fulfillmentStore ? 'SELLER' : isStoreParty(fulfillmentStore, userId) ? 'FULFILLER' : 'RESELLER',
      totalMinor: order.totalMinor.toString(),
      subtotalMinor: order.subtotalMinor.toString(),
      discountMinor: order.discountMinor.toString(),
      items: order.items.map((item) => ({
        ...item,
        unitPriceMinor: item.unitPriceMinor.toString(),
      })),
    }));
  }

  async checkout(user: AuthenticatedUser, input: CheckoutDto) {
    return this.checkoutAttempt(user, input, 0);
  }

  private async checkoutAttempt(user: AuthenticatedUser, input: CheckoutDto, attempt: number): Promise<{ checkoutPublicId: string; orders: { publicId: string; displayId: string; status: string }[] }> {
    const existing = await this.prisma.checkout.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { orders: true },
    });
    if (existing) return this.replayCheckout(existing, user.id);
    return this.prisma.$transaction(
      async (tx) => {
        const cart = await tx.cart.findUnique({
          where: { buyerId: user.id },
          include: {
            items: {
              include: {
                listing: {
                  include: {
                    store: {
                      include: {
                        sellerProfile: { select: { userId: true } },
                        policies: { orderBy: { version: 'desc' }, take: 1 },
                      },
                    },
                    variants: { include: { inventory: true, sourceVariant: true } },
                    sourceListing: {
                      include: { store: { include: { sellerProfile: { select: { userId: true } } } } },
                    },
                  },
                },
              },
            },
          },
        });
        if (!cart?.items.length) throw new BadRequestException('Cart is empty');
        const checkout = await tx.checkout.create({
          data: { buyerId: user.id, idempotencyKey: input.idempotencyKey },
        });
        if (input.saveAddress) {
          const delivery = input.delivery as Record<string, unknown>;
          await tx.savedAddress.create({ data: { userId: user.id, label: input.addressLabel?.trim() || 'Asosiy manzil', fullName: String(delivery.fullName ?? ''), phone: String(delivery.phone ?? ''), region: String(delivery.region ?? ''), address: String(delivery.address ?? ''), isDefault: (await tx.savedAddress.count({ where: { userId: user.id } })) === 0 } });
        }
        const byStore = new Map<string, typeof cart.items>();
        for (const item of cart.items)
          byStore.set(item.listing.storeId, [
            ...(byStore.get(item.listing.storeId) ?? []),
            item,
          ]);
        const orders = [];
        for (const [storeId, items] of byStore) {
          const store = items[0]!.listing.store;
          // The cart was validated when each item was added. Everything can
          // change before checkout, so purchasability is re-checked here,
          // inside the transaction that reserves the stock.
          // An item left in a cart from before the owner-only switch is refused here.
          if (store.status !== 'ACTIVE' || store.kind !== 'SELLER' || !isOwnerStore(store))
            throw new ConflictException('Store is no longer open for orders');
          if (store.vacationMode)
            throw new ConflictException('Store is in vacation mode');
          // One order is either entirely own stock or entirely fulfilled by one
          // supplier, so the party that ships it is unambiguous.
          type Line = {
            item: (typeof items)[number];
            variant: (typeof items)[number]['listing']['variants'][number];
            unitPrice: bigint;
            stockVariantId: string;
            resale: { supplierVariantId: string; wholesale: bigint; margin: bigint } | null;
          };
          const groups = new Map<string, { fulfillmentStoreId: string | null; supplierOwnerId: string | null; lines: Line[]; subtotal: bigint; margin: bigint }>();
          for (const item of items) {
            const variant = item.listing.variants.find(
              (v) => v.id === item.variantId,
            );
            if (item.listing.status !== 'ACTIVE' || item.listing.deletedAt)
              throw new ConflictException('A product in the cart is no longer on sale');
            if (!variant) throw new ConflictException('Variant unavailable');
            let unitPrice = variant.priceOverrideMinor ?? item.listing.priceMinor;
            let resale: Line['resale'] = null;
            const source = item.listing.sourceListing;
            if (item.listing.sourceListingId) {
              // Resale price is recomputed from the current supplier price; the
              // listing's own price is only a display cache.
              if (!source || !variant.sourceVariant || variant.sourceVariant.listingId !== source.id || !this.resaleSourceOpen(item.listing))
                throw new ConflictException('A product in the cart is no longer on sale');
              const wholesale = wholesaleUnitPrice(variant.sourceVariant, source);
              unitPrice = resellerUnitPrice(wholesale, item.listing.markupBps!);
              resale = { supplierVariantId: variant.sourceVariant.id, wholesale, margin: unitPrice - wholesale };
            }
            const stockVariantId = inventoryVariantId(variant);
            const reserved = await tx.inventory.updateMany({
              where: {
                variantId: stockVariantId,
                available: { gte: item.quantity },
              },
              data: {
                available: { decrement: item.quantity },
                reserved: { increment: item.quantity },
                version: { increment: 1 },
              },
            });
            if (reserved.count !== 1)
              throw new ConflictException('Stock changed; review cart');
            const fulfillmentStoreId = resale ? source!.storeId : null;
            const key = fulfillmentStoreId ?? 'own';
            const group = groups.get(key) ?? { fulfillmentStoreId, supplierOwnerId: resale ? source!.store.sellerProfile.userId : null, lines: [], subtotal: 0n, margin: 0n };
            group.lines.push({ item, variant, unitPrice, stockVariantId, resale });
            group.subtotal += unitPrice * BigInt(item.quantity);
            if (resale) group.margin += resale.margin * BigInt(item.quantity);
            groups.set(key, group);
          }
          const subtotal = [...groups.values()].reduce((sum, group) => sum + group.subtotal, 0n);
          const now = new Date();
          const requestedCode = input.couponCodes?.[store.publicId]
            ?.trim()
            .toUpperCase();
          const coupon = requestedCode
            ? await tx.coupon.findUnique({
                where: { storeId_code: { storeId, code: requestedCode } },
              })
            : null;
          let discount = 0n;
          if (coupon) {
            if (!coupon.active || coupon.startsAt > now || coupon.endsAt <= now)
              throw new ConflictException('Coupon is inactive or expired');
            const [used, buyerUsed] = await Promise.all([
              tx.couponRedemption.count({ where: { couponId: coupon.id } }),
              tx.couponRedemption.count({
                where: { couponId: coupon.id, userId: user.id },
              }),
            ]);
            if (coupon.usageLimit !== null && used >= coupon.usageLimit)
              throw new ConflictException('Coupon usage limit reached');
            if (coupon.buyerLimit !== null && buyerUsed >= coupon.buyerLimit)
              throw new ConflictException('Coupon buyer limit reached');
            discount = couponDiscount(coupon, subtotal);
            if (discount === 0n)
              throw new ConflictException('Coupon requirements are not met');
          } else if (requestedCode) {
            throw new NotFoundException('Coupon not found');
          }
          const expected = input.expectedTotalMinor?.[store.publicId];
          if (expected !== undefined && BigInt(expected) !== subtotal - discount)
            throw new ConflictException('Price changed since the cart was reviewed; confirm the new total');
          // The store's coupon is charged to its own-stock order first; any
          // remainder comes out of the reseller margin of the resale orders.
          let remaining = discount;
          let redemptionDone = false;
          const ordered = [...groups.values()].sort((a, b) => Number(a.fulfillmentStoreId !== null) - Number(b.fulfillmentStoreId !== null));
          for (const [index, group] of ordered.entries()) {
            const cap = group.fulfillmentStoreId ? group.margin : group.subtotal;
            // The last group takes whatever is left, so an over-large coupon on
            // resale items is rejected below rather than silently capped.
            const share = index === ordered.length - 1 || remaining <= cap ? remaining : cap;
            remaining -= share;
            const earning = group.fulfillmentStoreId ? earningAmount(group.margin, share) : null;
            if (group.fulfillmentStoreId && earning === null)
              throw new ConflictException('Kupon chegirmasi sotuvchi ustamasidan oshib ketdi');
            const total = group.subtotal - share;
            const snapshot = JSON.parse(
              JSON.stringify({
                store: {
                  publicId: store.publicId,
                  username: store.username,
                  nameUz: store.nameUz,
                },
                delivery: input.delivery,
                policy: store.policies[0] ?? null,
                commercial: {
                  commissionBasisPoints:
                    PLATFORM_BUSINESS_RULES.commissionBasisPoints,
                  paymentCollection: PLATFORM_BUSINESS_RULES.paymentCollection,
                  escrow: PLATFORM_BUSINESS_RULES.escrow,
                  settlement: PLATFORM_BUSINESS_RULES.settlement,
                },
                coupon: coupon && share > 0n
                  ? {
                      code: coupon.code,
                      kind: coupon.kind,
                      discountMinor: share.toString(),
                    }
                  : null,
              }),
            ) as Prisma.InputJsonValue;
            const order = await tx.order.create({
              data: {
                checkoutId: checkout.id,
                buyerId: user.id,
                storeId,
                fulfillmentStoreId: group.fulfillmentStoreId,
                displayId: `${store.orderPrefix}-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`,
                totalMinor: total,
                subtotalMinor: group.subtotal,
                discountMinor: share,
                sellerAcceptBy: sellerAcceptBy(now),
                snapshot,
                items: {
                  create: group.lines.map(({ item, variant, unitPrice, resale }) => ({
                    variantId: item.variantId,
                    quantity: item.quantity,
                    unitPriceMinor: unitPrice,
                    supplierVariantId: resale?.supplierVariantId ?? null,
                    supplierUnitPriceMinor: resale?.wholesale ?? null,
                    resellerMarginMinor: resale?.margin ?? null,
                    snapshot: {
                      listingPublicId: item.listing.publicId,
                      nameUz: item.listing.nameUz,
                      categoryId: item.listing.categoryId,
                      variantOptions: variant.options,
                      sku: variant.sku,
                    },
                  })),
                },
                reservations: {
                  // Stock is held on the variant that owns the Inventory row
                  // (the supplier variant for resale items), so every existing
                  // release/finalize path works unchanged.
                  create: group.lines.map(({ item, stockVariantId }) => ({
                    variantId: stockVariantId,
                    quantity: item.quantity,
                    expiresAt: sellerAcceptBy(now),
                  })),
                },
                history: {
                  create: { toStatus: 'WAITING_SELLER', actorId: user.id },
                },
                conversation: {
                  create: { members: { create: [{ userId: user.id }] } },
                },
              },
            });
            if (coupon && share > 0n && !redemptionDone) {
              await tx.couponRedemption.create({
                data: { couponId: coupon.id, userId: user.id, orderId: order.id },
              });
              redemptionDone = true;
            }
            if (group.fulfillmentStoreId)
              await tx.resellerEarning.create({
                data: { storeId, orderId: order.id, amountMinor: earning!, status: 'PENDING' },
              });
            await tx.notification.create({
              data: {
                userId: group.supplierOwnerId ?? store.sellerProfile.userId,
                severity: 'ACTION_REQUIRED',
                type: 'ORDER_ACTION_REQUIRED',
                payload: {
                  orderPublicId: order.publicId,
                  displayId: order.displayId,
                  sellerAcceptBy: order.sellerAcceptBy.toISOString(),
                },
              },
            });
            if (group.fulfillmentStoreId)
              await tx.notification.create({
                data: {
                  userId: store.sellerProfile.userId,
                  severity: 'INFO',
                  type: 'RESALE_ORDER_CREATED',
                  payload: { orderPublicId: order.publicId, displayId: order.displayId, earningMinor: earning!.toString() },
                },
              });
            orders.push({
              publicId: order.publicId,
              displayId: order.displayId,
              status: order.status,
              totalMinor: order.totalMinor.toString(),
              sellerAcceptBy: order.sellerAcceptBy,
            });
          }
        }
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        return { checkoutPublicId: checkout.publicId, orders };
      },
      { isolationLevel: 'Serializable' },
    ).catch(async (error: unknown) => {
      // Two submissions of the same idempotency key can race past the lookup
      // above. The loser must replay the winner's checkout, not fail with 500.
      if (isUniqueViolation(error)) {
        const raced = await this.prisma.checkout.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: { orders: true },
        });
        if (raced) return this.replayCheckout(raced, user.id);
      }
      // P2034 guarantees the entire transaction was rolled back. Retry only
      // that failure, retaining the original key and all stock/price checks.
      // Never retry timeouts or ambiguous transport failures automatically.
      if (isSerializationFailure(error) && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
        return this.checkoutAttempt(user, input, attempt + 1);
      }
      return mapSerializationFailure(error);
    });
  }

  private replayCheckout(checkout: {
    buyerId: string;
    publicId: string;
    orders: { publicId: string; displayId: string; status: string }[];
  }, buyerId: string) {
    if (checkout.buyerId !== buyerId) throw new ForbiddenException('Checkout access denied');
    return {
      checkoutPublicId: checkout.publicId,
      orders: checkout.orders.map((order) => ({
        publicId: order.publicId,
        displayId: order.displayId,
        status: order.status,
      })),
    };
  }

  async transition(
    user: AuthenticatedUser,
    publicId: string,
    to: OrderState,
    reason?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { publicId },
          include: {
            store: partyStoreInclude,
            fulfillmentStore: partyStoreInclude,
            reservations: true,
          },
        });
        if (!order) throw new NotFoundException('Order not found');
        const parties = orderParties(order, user.id);
        const seller = parties.fulfiller;
        const buyer = order.buyerId === user.id;
        if (!seller && !buyer && parties.reseller)
          throw new ForbiddenException('Bu buyurtmani supplier bajaradi; holatini faqat u o‘zgartiradi');
        if (!seller && !buyer)
          throw new ForbiddenException('Order access denied');
        // Buyer identity alone must never grant fulfillment privileges.
        if (buyer && !seller && to !== 'CANCELLED' && to !== 'COMPLETED')
          throw new ForbiddenException('Only the store owner can fulfill orders');
        if (!canTransitionOrder(order.status as OrderState, to))
          throw new ConflictException('Invalid order transition');
        if (
          buyer &&
          to === 'CANCELLED' &&
          !buyerCanCancelDirectly(order.status as OrderState)
        )
          throw new ConflictException(
            'Cancellation request is required after seller acceptance',
          );
        if (
          to === 'ACCEPTED' &&
          (!seller || order.sellerAcceptBy <= new Date())
        )
          throw new ConflictException('Acceptance window expired');
        if (to === 'CANCELLED' && !buyer && !seller)
          throw new ForbiddenException();
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: to,
            history: {
              create: {
                fromStatus: order.status,
                toStatus: to,
                actorId: user.id,
                reason: reason ?? null,
              },
            },
          },
        });
        await syncResellerEarning(tx, order.id, to);
        const recipientIds = seller
          ? [order.buyerId, ...(order.fulfillmentStore ? [order.store.sellerProfile.userId] : [])]
          : [parties.fulfilmentOwnerId, ...(order.fulfillmentStore ? [order.store.sellerProfile.userId] : [])];
        for (const recipientId of new Set(recipientIds.filter((id) => id !== user.id)))
        await tx.notification.create({
          data: {
            userId: recipientId,
            severity: ['REJECTED', 'TIMEOUT', 'CANCELLED', 'DISPUTED'].includes(
              to,
            )
              ? 'WARNING'
              : 'INFO',
            type: 'ORDER_STATUS_CHANGED',
            payload: {
              orderPublicId: order.publicId,
              displayId: order.displayId,
              from: order.status,
              to,
            },
          },
        });
        if (['REJECTED', 'TIMEOUT', 'CANCELLED'].includes(to))
          for (const reservation of order.reservations.filter(
            (r) => r.status === 'ACTIVE',
          )) {
            await tx.inventory.update({
              where: { variantId: reservation.variantId },
              data: {
                available: { increment: reservation.quantity },
                reserved: { decrement: reservation.quantity },
                version: { increment: 1 },
              },
            });
            await tx.stockReservation.update({
              where: { id: reservation.id },
              data: { status: 'RELEASED' },
            });
          }
        if (to === 'COMPLETED')
          for (const reservation of order.reservations.filter(
            (r) => r.status === 'ACTIVE',
          )) {
            await tx.inventory.update({
              where: { variantId: reservation.variantId },
              data: {
                reserved: { decrement: reservation.quantity },
                version: { increment: 1 },
              },
            });
            await tx.stockReservation.update({
              where: { id: reservation.id },
              data: { status: 'FINALIZED' },
            });
          }
        return { publicId, status: to };
      },
      { isolationLevel: 'Serializable' },
    ).catch(mapSerializationFailure);
  }

  async requestCancellation(
    user: AuthenticatedUser,
    publicId: string,
    reason: string,
  ) {
    const order = await this.prisma.order.findUnique({ where: { publicId } });
    if (!order || order.buyerId !== user.id)
      throw new NotFoundException('Order not found');
    if (buyerCanCancelDirectly(order.status as OrderState))
      throw new ConflictException(
        'Use direct cancellation before seller acceptance',
      );
    if (!['ACCEPTED', 'PREPARING', 'READY', 'SHIPPED'].includes(order.status))
      throw new ConflictException(
        'Cancellation cannot be requested in the current status',
      );
    const existing = await this.prisma.orderChange.findFirst({
      where: {
        orderId: order.id,
        actorId: user.id,
        kind: 'CANCELLATION_REQUEST',
        after: { path: ['status'], equals: 'PENDING' },
      },
    });
    if (existing) return { id: existing.id, status: 'PENDING' };
    const change = await this.prisma.orderChange.create({
      data: {
        orderId: order.id,
        actorId: user.id,
        kind: 'CANCELLATION_REQUEST',
        before: { orderStatus: order.status },
        after: { status: 'PENDING', reason },
      },
    });
    return { id: change.id, status: 'PENDING' };
  }

  async requestOrderChange(user: AuthenticatedUser, publicId: string, request: string) {
    const order = await this.prisma.order.findUnique({ where: { publicId }, include: { store: { include: { sellerProfile: true } }, fulfillmentStore: { include: { sellerProfile: true } } } });
    if (!order || order.buyerId !== user.id) throw new NotFoundException('Order not found');
    if (!['WAITING_SELLER','ACCEPTED','PREPARING'].includes(order.status)) throw new ConflictException('Order can no longer be changed');
    const change = await this.prisma.orderChange.create({ data: { orderId: order.id, actorId: user.id, kind: 'BUYER_CHANGE_REQUEST', before: { orderStatus: order.status }, after: { status: 'PENDING', request } } });
    await this.prisma.notification.create({ data: { userId: (order.fulfillmentStore ?? order.store).sellerProfile.userId, severity: 'ACTION_REQUIRED', type: 'ORDER_CHANGE_REQUESTED', payload: { orderPublicId: publicId, changeId: change.id, request } } });
    return { id: change.id, status: 'PENDING' };
  }

  async decideOrderChange(user: AuthenticatedUser, publicId: string, changeId: string, approved: boolean, reason?: string) {
    const order = await this.prisma.order.findUnique({ where: { publicId }, include: { store: partyStoreInclude, fulfillmentStore: partyStoreInclude } });
    if (!order) throw new NotFoundException('Order not found');
    const seller = orderParties(order, user.id).fulfiller; if(!seller)throw new ForbiddenException('Only seller can decide');
    const change=await this.prisma.orderChange.findFirst({where:{id:changeId,orderId:order.id,kind:'BUYER_CHANGE_REQUEST'}}); if(!change)throw new NotFoundException('Change request not found');
    const after=change.after as {status?:string;request?:string}|null; if(after?.status!=='PENDING')throw new ConflictException('Change request already decided');
    await this.prisma.orderChange.update({where:{id:change.id},data:{after:{...after,status:approved?'APPROVED':'REJECTED',reason:reason??null,decidedAt:new Date().toISOString()}}});
    await this.prisma.notification.create({data:{userId:order.buyerId,severity:'INFO',type:'ORDER_CHANGE_DECIDED',payload:{orderPublicId:publicId,approved,reason:reason??null}}});
    return {id:change.id,status:approved?'APPROVED':'REJECTED'};
  }

  async decideCancellation(
    user: AuthenticatedUser,
    publicId: string,
    approved: boolean,
    reason?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { publicId },
          include: {
            store: partyStoreInclude,
            fulfillmentStore: partyStoreInclude,
            reservations: true,
            changes: {
              where: {
                kind: 'CANCELLATION_REQUEST',
                after: { path: ['status'], equals: 'PENDING' },
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        });
        if (!order) throw new NotFoundException('Order not found');
        const seller = orderParties(order, user.id).fulfiller;
        if (!seller)
          throw new ForbiddenException(
            'Only the seller can decide cancellation requests',
          );
        const change = order.changes[0];
        if (!change)
          throw new ConflictException('No pending cancellation request');
        if (
          !['ACCEPTED', 'PREPARING', 'READY', 'SHIPPED'].includes(order.status)
        )
          throw new ConflictException(
            'Cancellation request is no longer actionable',
          );
        await tx.orderChange.update({
          where: { id: change.id },
          data: {
            after: {
              status: approved ? 'APPROVED' : 'REJECTED',
              reason: reason ?? null,
              decidedBy: user.publicId,
              decidedAt: new Date().toISOString(),
            },
          },
        });
        if (approved) {
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: 'CANCELLED',
              history: {
                create: {
                  fromStatus: order.status,
                  toStatus: 'CANCELLED',
                  actorId: user.id,
                  reason: reason ?? 'Cancellation request approved',
                },
              },
            },
          });
          await syncResellerEarning(tx, order.id, 'CANCELLED');
          for (const reservation of order.reservations.filter(
            (item) => item.status === 'ACTIVE',
          )) {
            await tx.inventory.update({
              where: { variantId: reservation.variantId },
              data: {
                available: { increment: reservation.quantity },
                reserved: { decrement: reservation.quantity },
                version: { increment: 1 },
              },
            });
            await tx.stockReservation.update({
              where: { id: reservation.id },
              data: { status: 'RELEASED' },
            });
          }
        }
        await tx.notification.create({
          data: {
            userId: order.buyerId,
            severity: approved ? 'WARNING' : 'INFO',
            type: 'CANCELLATION_DECIDED',
            payload: {
              orderPublicId: order.publicId,
              approved,
              reason: reason ?? null,
            },
          },
        });
        return {
          publicId,
          status: approved ? 'CANCELLED' : order.status,
          cancellation: approved ? 'APPROVED' : 'REJECTED',
        };
      },
      { isolationLevel: 'Serializable' },
    ).catch(mapSerializationFailure);
  }

  async requestReturn(
    user: AuthenticatedUser,
    publicId: string,
    reason: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { publicId },
          include: { store: { include: { sellerProfile: true } }, fulfillmentStore: { include: { sellerProfile: true } } },
        });
        if (!order || order.buyerId !== user.id)
          throw new NotFoundException('Order not found');
        if (order.status !== 'DELIVERED')
          throw new ConflictException(
            'Return can only be requested after delivery',
          );
        const existing = await tx.orderChange.findFirst({
          where: { orderId: order.id, kind: 'RETURN_REQUEST' },
        });
        if (existing) return { id: existing.id, status: order.status };
        const change = await tx.orderChange.create({
          data: {
            orderId: order.id,
            actorId: user.id,
            kind: 'RETURN_REQUEST',
            before: { orderStatus: order.status },
            after: { status: 'PENDING', reason },
          },
        });
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'RETURN_REQUESTED',
            history: {
              create: {
                fromStatus: order.status,
                toStatus: 'RETURN_REQUESTED',
                actorId: user.id,
                reason,
              },
            },
          },
        });
        await syncResellerEarning(tx, order.id, 'RETURN_REQUESTED');
        await tx.notification.create({
          data: {
            userId: (order.fulfillmentStore ?? order.store).sellerProfile.userId,
            severity: 'ACTION_REQUIRED',
            type: 'RETURN_REQUESTED',
            payload: { orderPublicId: order.publicId, reason },
          },
        });
        return { id: change.id, status: 'RETURN_REQUESTED' };
      },
      { isolationLevel: 'Serializable' },
    ).catch(mapSerializationFailure);
  }

  async decideReturn(user: AuthenticatedUser, publicId: string, approved: boolean, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const order=await tx.order.findUnique({where:{publicId},include:{store:partyStoreInclude,fulfillmentStore:partyStoreInclude,changes:{where:{kind:'RETURN_REQUEST'},orderBy:{createdAt:'desc'},take:1}}});
      if(!order)throw new NotFoundException('Order not found'); const seller=orderParties(order,user.id).fulfiller;if(!seller)throw new ForbiddenException('Only seller can decide return');if(order.status!=='RETURN_REQUESTED'||!order.changes[0])throw new ConflictException('No pending return request');
      const after=order.changes[0].after as {status?:string;reason?:string}|null;if(after?.status!=='PENDING')throw new ConflictException('Return already decided');
      await tx.orderChange.update({where:{id:order.changes[0].id},data:{after:{...after,status:approved?'APPROVED':'REJECTED',decisionReason:reason??null,decidedAt:new Date().toISOString()}}});
      if(!approved)await tx.order.update({where:{id:order.id},data:{status:'COMPLETED',history:{create:{fromStatus:'RETURN_REQUESTED',toStatus:'COMPLETED',actorId:user.id,reason:reason??'Return rejected'}}}});
      await syncResellerEarning(tx, order.id, approved ? 'RETURN_APPROVED' : 'COMPLETED');
      await tx.notification.create({data:{userId:order.buyerId,severity:approved?'ACTION_REQUIRED':'INFO',type:'RETURN_DECIDED',payload:{orderPublicId:publicId,approved,reason:reason??null}}});return {status:approved?'RETURN_APPROVED':'COMPLETED'};
    },{isolationLevel:'Serializable'}).catch(mapSerializationFailure);
  }

  async message(user: AuthenticatedUser, orderPublicId: string, body: string) {
    const order = await this.prisma.order.findUnique({
      where: { publicId: orderPublicId },
      include: {
        conversation: true,
        store: { include: { sellerProfile: true, members: true } },
      },
    });
    if (!order?.conversation)
      throw new NotFoundException('Order conversation not found');
    if (
      order.buyerId !== user.id &&
      order.store.sellerProfile.userId !== user.id
    )
      throw new ForbiddenException();
    return this.prisma.message.create({
      data: { conversationId: order.conversation.id, senderId: user.id, body },
      select: { id: true, body: true, createdAt: true },
    });
  }

  async locationMessage(user: AuthenticatedUser, orderPublicId: string, input: LocationMessageDto) {
    await this.messages(user, orderPublicId);
    const order = await this.prisma.order.findUniqueOrThrow({ where: { publicId: orderPublicId }, select: { conversation: { select: { id: true } } } });
    return this.prisma.message.create({ data: { conversationId: order.conversation!.id, senderId: user.id, kind: 'LOCATION', body: input.label ?? 'Joylashuv', attachment: { latitude: input.latitude, longitude: input.longitude } }, select: { id: true, kind: true, body: true, attachment: true, createdAt: true } });
  }

  async markMessagesRead(user: AuthenticatedUser, orderPublicId: string) {
    await this.messages(user, orderPublicId);
    const order = await this.prisma.order.findUniqueOrThrow({ where: { publicId: orderPublicId }, select: { conversation: { select: { id: true } } } });
    await this.prisma.conversationMember.upsert({ where: { conversationId_userId: { conversationId: order.conversation!.id, userId: user.id } }, create: { conversationId: order.conversation!.id, userId: user.id, lastReadAt: new Date() }, update: { lastReadAt: new Date() } });
    return { read: true };
  }

  async messages(user: AuthenticatedUser, orderPublicId: string) {
    const order = await this.prisma.order.findUnique({
      where: { publicId: orderPublicId },
      include: {
        conversation: true,
        store: { include: { sellerProfile: true, members: true } },
      },
    });
    if (!order?.conversation)
      throw new NotFoundException('Order conversation not found');
    if (
      order.buyerId !== user.id &&
      order.store.sellerProfile.userId !== user.id
    )
      throw new ForbiddenException();
    return this.prisma.message.findMany({
      where: { conversationId: order.conversation.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        senderId: true,
        kind: true,
        body: true,
        attachment: true,
        createdAt: true,
        attachments: {
          select: { id: true, fileName: true, mimeType: true, sizeBytes: true },
        },
      },
    });
  }

  async question(userId: string, input: QuestionDto) {
    const store = await this.prisma.store.findUnique({
      where: { publicId: input.storePublicId },
    });
    if (!store || store.kind !== 'SELLER' || !isOwnerStore(store)) throw new NotFoundException('Store not found');
    // A question may only point at a buyer-visible listing of the same store.
    const listing = input.listingPublicId
      ? await this.prisma.listing.findFirst({
          where: { publicId: input.listingPublicId, storeId: store.id, deletedAt: null },
        })
      : null;
    if (input.listingPublicId && !listing)
      throw new BadRequestException('Mahsulot bu do‘konga tegishli emas');
    return this.prisma.storeQuestion.create({
      data: {
        storeId: store.id,
        listingId: listing?.id ?? null,
        authorId: userId,
        body: input.body,
      },
      select: { id: true, body: true, createdAt: true },
    });
  }

  async answer(user: AuthenticatedUser, questionId: string, body: string) {
    const question = await this.prisma.storeQuestion.findUnique({
      where: { id: questionId },
      include: { store: { include: { sellerProfile: true, members: true } } },
    });
    if (!question) throw new NotFoundException('Question not found');
    if (
      question.store.sellerProfile.userId !== user.id &&
      !question.store.members.some((m) => m.userId === user.id)
    )
      throw new ForbiddenException();
    return this.prisma.storeAnswer.upsert({
      where: { questionId },
      create: { questionId, authorId: user.id, body },
      update: { body },
      select: { id: true, body: true, createdAt: true },
    });
  }

  async reportQuestion(userId: string, questionId: string, reason: string) {
    const question = await this.prisma.storeQuestion.findUnique({
      where: { id: questionId },
    });
    if (!question) throw new NotFoundException('Question not found');
    if (question.authorId === userId)
      throw new ConflictException('You cannot report your own question');
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.questionReport.upsert({
        where: { questionId_reporterId: { questionId, reporterId: userId } },
        create: { questionId, reporterId: userId, reason },
        update: { reason, status: 'OPEN', resolution: null, reviewedAt: null },
        select: { id: true, status: true, createdAt: true },
      });
      await tx.storeQuestion.update({
        where: { id: questionId },
        data: { reportedAt: new Date() },
      });
      return report;
    });
  }

  async openDispute(user: AuthenticatedUser, publicId: string, reason: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { publicId },
          include: {
            store: partyStoreInclude,
            fulfillmentStore: partyStoreInclude,
            dispute: true,
          },
        });
        if (!order) throw new NotFoundException('Order not found');
        const parties = orderParties(order, user.id);
        const seller = parties.anySeller;
        if (!seller && order.buyerId !== user.id)
          throw new ForbiddenException('Order access denied');
        if (order.dispute)
          return { id: order.dispute.id, status: order.dispute.status };
        if (
          ![
            'ACCEPTED',
            'PREPARING',
            'READY',
            'SHIPPED',
            'DELIVERED',
            'COMPLETED',
            'RETURN_REQUESTED',
          ].includes(order.status)
        )
          throw new ConflictException(
            'A dispute cannot be opened in the current status',
          );
        const dispute = await tx.dispute.create({
          data: {
            orderId: order.id,
            reason,
            events: {
              create: {
                actorId: user.id,
                type: 'OPENED',
                payload: { reason, orderStatus: order.status },
              },
            },
          },
        });
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'DISPUTED',
            history: {
              create: {
                fromStatus: order.status,
                toStatus: 'DISPUTED',
                actorId: user.id,
                reason,
              },
            },
          },
        });
        await syncResellerEarning(tx, order.id, 'DISPUTED');
        await tx.notification.create({
          data: {
            userId: seller ? order.buyerId : parties.fulfilmentOwnerId,
            severity: 'ACTION_REQUIRED',
            type: 'DISPUTE_OPENED',
            payload: { orderPublicId: order.publicId, disputeId: dispute.id },
          },
        });
        return { id: dispute.id, status: dispute.status };
      },
      { isolationLevel: 'Serializable' },
    ).catch(mapSerializationFailure);
  }

  async review(userId: string, orderPublicId: string, input: ReviewDto) {
    const order = await this.prisma.order.findUnique({
      where: { publicId: orderPublicId },
    });
    if (!order || order.buyerId !== userId)
      throw new NotFoundException('Order not found');
    if (order.status !== 'COMPLETED')
      throw new ConflictException('Only completed orders can be reviewed');
    return this.prisma.review.create({
      data: {
        orderId: order.id,
        rating: input.rating,
        body: input.body ?? null,
      },
    });
  }

  async dashboard(userId: string) {
    const stores = await this.prisma.store.findMany({
      where: {
        sellerProfile: { userId },
      },
      select: { id: true },
    });
    const ids = stores.map((s) => s.id);
    const [waiting, lowStock, unreadQuestions] = await Promise.all([
      this.prisma.order.count({
        where: {
          status: 'WAITING_SELLER',
          OR: [
            { storeId: { in: ids }, fulfillmentStoreId: null },
            { fulfillmentStoreId: { in: ids } },
          ],
        },
      }),
      this.prisma.inventory.count({
        where: {
          available: { lte: 5 },
          variant: { listing: { storeId: { in: ids } } },
        },
      }),
      this.prisma.storeQuestion.count({
        where: { storeId: { in: ids }, answer: null },
      }),
    ]);
    return {
      waitingOrders: waiting,
      lowStock,
      unansweredQuestions: unreadQuestions,
    };
  }
}
