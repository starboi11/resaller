import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
  QuestionDto,
  ReviewDto,
} from './operations.dto.js';
import type { Prisma } from '../generated/prisma/client.js';
import { couponDiscount } from './coupon-policy.js';

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

  async cart(userId: string) {
    const cart = await this.prisma.cart.upsert({
      where: { buyerId: userId },
      create: { buyerId: userId },
      update: {},
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
          include: { inventory: true },
        },
        store: true,
      },
    });
    if (
      !listing ||
      listing.status !== 'ACTIVE' ||
      listing.store.status !== 'ACTIVE'
    )
      throw new NotFoundException('Active listing not found');
    const variant = listing.variants[0];
    if (!variant?.inventory || variant.inventory.available < input.quantity)
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
    return orders.map((order) => ({
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

  async sellerOrders(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        store: {
          OR: [
            { sellerProfile: { userId } },
            { members: { some: { userId } } },
          ],
        },
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        store: { select: { publicId: true, username: true, nameUz: true } },
        items: {
          select: { quantity: true, unitPriceMinor: true, snapshot: true },
        },
      },
    });
    return orders.map((order) => ({
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

  async checkout(user: AuthenticatedUser, input: CheckoutDto) {
    const existing = await this.prisma.checkout.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { orders: true },
    });
    if (existing)
      return {
        checkoutPublicId: existing.publicId,
        orders: existing.orders.map((o) => ({
          publicId: o.publicId,
          displayId: o.displayId,
          status: o.status,
        })),
      };
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
                    variants: { include: { inventory: true } },
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
        const byStore = new Map<string, typeof cart.items>();
        for (const item of cart.items)
          byStore.set(item.listing.storeId, [
            ...(byStore.get(item.listing.storeId) ?? []),
            item,
          ]);
        const orders = [];
        for (const [storeId, items] of byStore) {
          const store = items[0]!.listing.store;
          let subtotal = 0n;
          for (const item of items) {
            const variant = item.listing.variants.find(
              (v) => v.id === item.variantId,
            );
            if (!variant?.inventory)
              throw new ConflictException('Variant unavailable');
            const reserved = await tx.inventory.updateMany({
              where: {
                variantId: item.variantId,
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
            subtotal +=
              (variant.priceOverrideMinor ?? item.listing.priceMinor) *
              BigInt(item.quantity);
          }
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
          const total = subtotal - discount;
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
              coupon: coupon
                ? {
                    code: coupon.code,
                    kind: coupon.kind,
                    discountMinor: discount.toString(),
                  }
                : null,
            }),
          ) as Prisma.InputJsonValue;
          const order = await tx.order.create({
            data: {
              checkoutId: checkout.id,
              buyerId: user.id,
              storeId,
              displayId: `${store.orderPrefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
              totalMinor: total,
              subtotalMinor: subtotal,
              discountMinor: discount,
              sellerAcceptBy: sellerAcceptBy(now),
              snapshot,
              items: {
                create: items.map((item) => {
                  const variant = item.listing.variants.find(
                    (v) => v.id === item.variantId,
                  )!;
                  return {
                    variantId: item.variantId,
                    quantity: item.quantity,
                    unitPriceMinor:
                      variant.priceOverrideMinor ?? item.listing.priceMinor,
                    snapshot: {
                      listingPublicId: item.listing.publicId,
                      nameUz: item.listing.nameUz,
                      variantOptions: variant.options,
                      sku: variant.sku,
                    },
                  };
                }),
              },
              reservations: {
                create: items.map((item) => ({
                  variantId: item.variantId,
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
          if (coupon)
            await tx.couponRedemption.create({
              data: { couponId: coupon.id, userId: user.id, orderId: order.id },
            });
          await tx.notification.create({
            data: {
              userId: store.sellerProfile.userId,
              severity: 'ACTION_REQUIRED',
              type: 'ORDER_ACTION_REQUIRED',
              payload: {
                orderPublicId: order.publicId,
                displayId: order.displayId,
                sellerAcceptBy: order.sellerAcceptBy.toISOString(),
              },
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
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        return { checkoutPublicId: checkout.publicId, orders };
      },
      { isolationLevel: 'Serializable' },
    );
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
            store: { include: { sellerProfile: true, members: true } },
            reservations: true,
          },
        });
        if (!order) throw new NotFoundException('Order not found');
        const seller =
          order.store.sellerProfile.userId === user.id ||
          order.store.members.some((m) => m.userId === user.id);
        const buyer = order.buyerId === user.id;
        if (!seller && !buyer)
          throw new ForbiddenException('Order access denied');
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
        const recipientId = seller
          ? order.buyerId
          : order.store.sellerProfile.userId;
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
    );
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
            store: { include: { sellerProfile: true, members: true } },
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
        const seller =
          order.store.sellerProfile.userId === user.id ||
          order.store.members.some((member) => member.userId === user.id);
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
    );
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
          include: { store: { include: { sellerProfile: true } } },
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
        await tx.notification.create({
          data: {
            userId: order.store.sellerProfile.userId,
            severity: 'ACTION_REQUIRED',
            type: 'RETURN_REQUESTED',
            payload: { orderPublicId: order.publicId, reason },
          },
        });
        return { id: change.id, status: 'RETURN_REQUESTED' };
      },
      { isolationLevel: 'Serializable' },
    );
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
      order.store.sellerProfile.userId !== user.id &&
      !order.store.members.some((m) => m.userId === user.id)
    )
      throw new ForbiddenException();
    return this.prisma.message.create({
      data: { conversationId: order.conversation.id, senderId: user.id, body },
      select: { id: true, body: true, createdAt: true },
    });
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
      order.store.sellerProfile.userId !== user.id &&
      !order.store.members.some((m) => m.userId === user.id)
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
        createdAt: true,
        attachments: { select: { id: true, mimeType: true, sizeBytes: true } },
      },
    });
  }

  async question(userId: string, input: QuestionDto) {
    const store = await this.prisma.store.findUnique({
      where: { publicId: input.storePublicId },
    });
    if (!store) throw new NotFoundException('Store not found');
    const listing = input.listingPublicId
      ? await this.prisma.listing.findUnique({
          where: { publicId: input.listingPublicId },
        })
      : null;
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
        OR: [{ sellerProfile: { userId } }, { members: { some: { userId } } }],
      },
      select: { id: true },
    });
    const ids = stores.map((s) => s.id);
    const [waiting, lowStock, unreadQuestions] = await Promise.all([
      this.prisma.order.count({
        where: { storeId: { in: ids }, status: 'WAITING_SELLER' },
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
