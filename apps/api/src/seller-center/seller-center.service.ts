import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../infrastructure/prisma.service.js';
import { EndpointCryptoService } from '../notifications/endpoint-crypto.service.js';
import type { AuthenticatedUser } from '../auth/session.guard.js';
import { isSerializationFailure, isUniqueViolation, mapSerializationFailure } from '../common/prisma-errors.js';
import type { CreateExternalOrderDto, TransitionExternalOrderDto, UpdateDeliveryDto, UpdatePaymentRecordDto, AdjustStockDto, UpdateCustomerDto, CreateExpenseDto } from './seller-center.dto.js';
import { isConfiguredOwnerStore } from '../owner/owner-access.js';

type Capability = 'orders.view' | 'orders.edit' | 'inventory.view' | 'inventory.edit' | 'customers.view' | 'customers.edit' | 'delivery.edit' | 'finance.view' | 'finance.edit' | 'analytics.view';
const operatorPermissions = new Set<Capability>(['orders.view', 'orders.edit', 'inventory.view', 'customers.view', 'delivery.edit']);
const nextStatuses: Record<string, string[]> = {
  NEW: ['PENDING', 'CONFIRMED', 'CANCELLED'], PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'], PREPARING: ['READY', 'CANCELLED'],
  READY: ['SHIPPED', 'DELIVERED', 'CANCELLED'], SHIPPED: ['DELIVERED'],
  DELIVERED: [], CANCELLED: [],
};
// Payment status is seller-recorded, so a seller may freely correct a
// collection mistake between UNPAID, PARTIAL and PAID. A refund is different:
// finance() excludes refunded orders from revenue and counts them under
// refundsMinor, so REFUNDED is terminal -- otherwise a refunded order could be
// flipped back and silently re-enter revenue. A delivered order counts as
// revenue whether or not it was marked PAID, which is why a refund is
// reachable from every non-refunded state.
const nextPaymentStatuses: Record<string, string[]> = {
  UNPAID: ['PARTIAL', 'PAID', 'REFUNDED'],
  PARTIAL: ['UNPAID', 'PAID', 'REFUNDED'],
  PAID: ['UNPAID', 'PARTIAL', 'REFUNDED'],
  REFUNDED: [],
};
const asJson = <T>(value: T): T => JSON.parse(JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item)) as T;
const uzDay = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const dayStart = (day: string) => new Date(`${day}T00:00:00+05:00`);

@Injectable()
export class SellerCenterService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EndpointCryptoService) private readonly crypto: EndpointCryptoService) {}

  private async storeFor(user: AuthenticatedUser, publicId: string, ...capabilities: Capability[]) {
    const store = await this.prisma.store.findUnique({ where: { publicId },
      select: { id: true, publicId: true, username: true, nameUz: true, status: true,
        sellerProfile: { select: { userId: true, verifiedAt: true } },
        members: { where: { userId: user.id }, select: { role: true } } } });
    if (!store) throw new NotFoundException('Store not found');
    const owner = store.sellerProfile.userId === user.id;
    const manager = store.members.some((member) => member.role === 'STORE_MANAGER');
    const operator = store.members.some((member) => member.role === 'ORDER_OPERATOR');
    const permitted = (capability: Capability) => owner || manager || (operator && operatorPermissions.has(capability));
    if (!capabilities.every(permitted)) throw new ForbiddenException('Store permission denied');
    // The owner runs the shop without the retired seller application/ID check.
    if (!store.sellerProfile.verifiedAt && !isConfiguredOwnerStore(store))
      throw new ForbiddenException('Seller identity verification is required');
    return store;
  }

  private phoneHash(storeId: string, phone: string) {
    return createHmac('sha256', process.env.DATA_ENCRYPTION_KEY ?? process.env.SESSION_SECRET ?? 'development-only')
      .update(`${storeId}:${phone}`).digest('hex');
  }

  async orders(user: AuthenticatedUser, publicId: string) {
    const store = await this.storeFor(user, publicId, 'orders.view');
    return this.ordersFor(store.id);
  }

  private async ordersFor(storeId: string) {
    const [marketplace, external] = await Promise.all([
      // A supplier store also sees the resale orders it must ship.
      this.prisma.order.findMany({ where: { OR: [{ storeId: storeId }, { fulfillmentStoreId: storeId }] }, take: 100, orderBy: { createdAt: 'desc' },
        select: { publicId: true, displayId: true, status: true, totalMinor: true, createdAt: true, storeId: true, fulfillmentStoreId: true,
          buyer: { select: { username: true } }, items: { select: { quantity: true, snapshot: true } } } }),
      this.prisma.externalOrder.findMany({ where: { storeId: storeId }, take: 100, orderBy: { createdAt: 'desc' },
        select: { publicId: true, status: true, source: true, paymentStatus: true, totalMinor: true, createdAt: true,
          customer: { select: { name: true } }, items: { select: { quantity: true, snapshot: true } } } }),
    ]);
    return asJson([
      ...marketplace.map(({ storeId: orderStoreId, fulfillmentStoreId, ...order }) => ({ ...order, source: 'RESALLER', customerName: order.buyer.username, paymentStatus: 'DEFERRED',
        kind: 'MARKETPLACE' as const,
        // FULFIL: this store ships a reseller's order. RESALE: a supplier ships it for this store.
        resaleRole: fulfillmentStoreId === storeId && orderStoreId !== storeId ? 'FULFIL' : fulfillmentStoreId ? 'RESALE' : null })),
      ...external.map((order) => ({ ...order, customerName: order.customer?.name ?? 'Noma’lum', kind: 'EXTERNAL' as const })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
  }

  async createExternalOrder(user: AuthenticatedUser, publicId: string, input: CreateExternalOrderDto) {
    const store = await this.storeFor(user, publicId, 'orders.edit');
    const existing = await this.prisma.externalOrder.findUnique({ where: { storeId_idempotencyKey: { storeId: store.id, idempotencyKey: input.idempotencyKey } }, select: { publicId: true, status: true, totalMinor: true } });
    if (existing) return { publicId: existing.publicId, status: existing.status, totalMinor: existing.totalMinor.toString(), duplicate: true };
    if (new Set(input.items.map((item) => item.variantId)).size !== input.items.length)
      throw new BadRequestException('The same variant cannot appear twice');
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Resale variants are excluded: their stock belongs to the supplier, who
        // must receive a real order to ship them.
        const variants = await tx.listingVariant.findMany({ where: { id: { in: input.items.map((item) => item.variantId) }, sourceVariantId: null, listing: { storeId: store.id, deletedAt: null } },
          select: { id: true, sku: true, options: true, listing: { select: { publicId: true, nameUz: true, categoryId: true } } } });
        if (variants.length !== input.items.length) throw new BadRequestException('Variant does not belong to this store (qayta sotiladigan mahsulotlar faqat Resaller buyurtmasi orqali sotiladi)');
        let subtotal = 0n;
        let costOfGoods = 0n;
        const itemData = input.items.map((item) => {
          const variant = variants.find((entry) => entry.id === item.variantId)!;
          const price = BigInt(item.unitPriceMinor);
          const cost = BigInt(item.unitCostMinor);
          subtotal += price * BigInt(item.quantity);
          costOfGoods += cost * BigInt(item.quantity);
          return { variantId: item.variantId, quantity: item.quantity, unitPriceMinor: price, unitCostMinor: cost,
            snapshot: { listingPublicId: variant.listing.publicId, listingName: variant.listing.nameUz,
              categoryId: variant.listing.categoryId, sku: variant.sku, options: variant.options,
              unitPriceMinor: item.unitPriceMinor, unitCostMinor: item.unitCostMinor } };
        });
        const discount = BigInt(input.discountMinor);
        if (discount > subtotal) throw new BadRequestException('Discount exceeds subtotal');
        const phoneHash = input.customerPhone ? this.phoneHash(store.id, input.customerPhone) : null;
        const customer = phoneHash
          ? await tx.storeCustomer.upsert({ where: { storeId_phoneHash: { storeId: store.id, phoneHash } },
              create: { storeId: store.id, name: input.customerName.trim(), phoneHash, phoneEncrypted: this.crypto.encrypt(input.customerPhone!) },
              update: { name: input.customerName.trim() } })
          : await tx.storeCustomer.create({ data: { storeId: store.id, name: input.customerName.trim() } });
        // The inventory update and order creation are one transaction. A failed reservation rolls all of it back.
        for (const item of input.items) {
          const result = await tx.inventory.updateMany({ where: { variantId: item.variantId, available: { gte: item.quantity } },
            data: { available: { decrement: item.quantity }, reserved: { increment: item.quantity }, version: { increment: 1 } } });
          if (result.count !== 1) throw new ConflictException('Stock changed; review the order');
        }
        const order = await tx.externalOrder.create({ data: {
          storeId: store.id, customerId: customer.id, source: input.source, status: 'NEW',
          idempotencyKey: input.idempotencyKey, subtotalMinor: subtotal, discountMinor: discount,
          deliveryCostMinor: BigInt(input.deliveryCostMinor), totalMinor: subtotal - discount,
          costOfGoodsMinor: costOfGoods, notes: input.notes?.trim() || null,
          deliveryAddressEncrypted: input.deliveryAddress ? this.crypto.encrypt(input.deliveryAddress.trim()) : null,
          items: { create: itemData }, history: { create: { toStatus: 'NEW', actorId: user.id } },
        }, select: { id: true, publicId: true, status: true, totalMinor: true } });
        for (const item of input.items) await tx.stockMovement.create({ data: { storeId: store.id, variantId: item.variantId,
          externalOrderId: order.id, actorId: user.id, type: 'EXTERNAL_RESERVE', availableDelta: -item.quantity, reservedDelta: item.quantity } });
        await tx.auditLog.create({ data: { actorId: user.id, action: 'EXTERNAL_ORDER_CREATED', targetType: 'ExternalOrder', targetId: order.id,
          metadata: { storeId: store.id, source: input.source, itemCount: input.items.length } } });
        return { publicId: order.publicId, status: order.status, totalMinor: order.totalMinor.toString(), duplicate: false };
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await this.prisma.externalOrder.findUnique({ where: { storeId_idempotencyKey: { storeId: store.id, idempotencyKey: input.idempotencyKey } }, select: { publicId: true, status: true, totalMinor: true } });
        if (raced) return { publicId: raced.publicId, status: raced.status, totalMinor: raced.totalMinor.toString(), duplicate: true };
      }
      if (isSerializationFailure(error)) throw new ConflictException('Concurrent stock update; retry the order');
      throw error;
    }
  }

  async externalOrder(user: AuthenticatedUser, publicId: string, orderPublicId: string) {
    const store = await this.storeFor(user, publicId, 'orders.view');
    const order = await this.prisma.externalOrder.findFirst({ where: { publicId: orderPublicId, storeId: store.id },
      include: { customer: { select: { publicId: true, name: true, phoneEncrypted: true } },
        items: true, history: { orderBy: { createdAt: 'asc' } } } });
    if (!order) throw new NotFoundException('External order not found');
    const { deliveryAddressEncrypted, customer, ...safe } = order;
    return asJson({ ...safe, customer: customer && { publicId: customer.publicId, name: customer.name,
      phone: customer.phoneEncrypted ? this.crypto.decrypt(customer.phoneEncrypted) : null },
      deliveryAddress: deliveryAddressEncrypted ? this.crypto.decrypt(deliveryAddressEncrypted) : null,
      buyerProtection: false, verifiedMarketplacePurchase: false });
  }

  async transition(user: AuthenticatedUser, publicId: string, orderPublicId: string, input: TransitionExternalOrderDto) {
    const store = await this.storeFor(user, publicId, 'orders.edit');
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.externalOrder.findFirst({ where: { publicId: orderPublicId, storeId: store.id },
        include: { items: { select: { variantId: true, quantity: true } } } });
      if (!order) throw new NotFoundException('External order not found');
      if (order.status === input.status) return { publicId: order.publicId, status: order.status, unchanged: true };
      if (!nextStatuses[order.status]?.includes(input.status)) throw new ConflictException('Invalid external order transition');
      const changed = await tx.externalOrder.updateMany({ where: { id: order.id, status: order.status }, data: { status: input.status } });
      if (changed.count !== 1) throw new ConflictException('Order changed; reload');
      if (input.status === 'CANCELLED' || input.status === 'DELIVERED') {
        for (const item of order.items) {
          const inventory = await tx.inventory.updateMany({ where: { variantId: item.variantId, reserved: { gte: item.quantity } },
            data: input.status === 'CANCELLED'
              ? { available: { increment: item.quantity }, reserved: { decrement: item.quantity }, version: { increment: 1 } }
              : { reserved: { decrement: item.quantity }, version: { increment: 1 } } });
          if (inventory.count !== 1) throw new ConflictException('Stock reservation is inconsistent');
          await tx.stockMovement.create({ data: { storeId: store.id, variantId: item.variantId, externalOrderId: order.id,
            actorId: user.id, type: input.status === 'CANCELLED' ? 'EXTERNAL_RELEASE' : 'EXTERNAL_FINALIZE',
            availableDelta: input.status === 'CANCELLED' ? item.quantity : 0, reservedDelta: -item.quantity,
            reason: input.reason?.trim() || null } });
        }
      }
      await tx.externalOrderHistory.create({ data: { externalOrderId: order.id, fromStatus: order.status,
        toStatus: input.status, actorId: user.id, reason: input.reason?.trim() || null } });
      await tx.auditLog.create({ data: { actorId: user.id, action: 'EXTERNAL_ORDER_STATUS_CHANGED', targetType: 'ExternalOrder',
        targetId: order.id, reason: input.reason?.trim() || null, metadata: { from: order.status, to: input.status, storeId: store.id } } });
      return { publicId: order.publicId, status: input.status, unchanged: false };
    }, { isolationLevel: 'Serializable' }).catch((error: unknown) => {
      if (isSerializationFailure(error)) throw new ConflictException('Order changed concurrently; reload');
      throw error;
    });
  }

  async updateDelivery(user: AuthenticatedUser, publicId: string, orderPublicId: string, input: UpdateDeliveryDto) {
    const store = await this.storeFor(user, publicId, 'delivery.edit');
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.externalOrder.findFirst({ where: { publicId: orderPublicId, storeId: store.id }, select: { id: true, status: true } });
      if (!order) throw new NotFoundException('External order not found');
      if (['DELIVERED', 'CANCELLED'].includes(order.status)) throw new ConflictException('Closed order delivery cannot change');
      const changed = await tx.externalOrder.updateMany({ where: { id: order.id, status: order.status }, data: {
        ...(input.deliveryAddress !== undefined ? { deliveryAddressEncrypted: input.deliveryAddress.trim() ? this.crypto.encrypt(input.deliveryAddress.trim()) : null } : {}),
        ...(input.courierName !== undefined ? { courierName: input.courierName.trim() || null } : {}),
        ...(input.trackingNumber !== undefined ? { trackingNumber: input.trackingNumber.trim() || null } : {}),
      } });
      if (changed.count !== 1) throw new ConflictException('Order changed; reload');
      await tx.auditLog.create({ data: { actorId: user.id, action: 'EXTERNAL_ORDER_DELIVERY_UPDATED', targetType: 'ExternalOrder', targetId: order.id,
        metadata: { storeId: store.id, fields: Object.keys(input) } } });
    }, { isolationLevel: 'Serializable' }).catch((error: unknown) => {
      if (isSerializationFailure(error)) throw new ConflictException('Delivery changed concurrently; reload');
      throw error;
    });
    return { updated: true };
  }

  async updatePaymentRecord(user: AuthenticatedUser, publicId: string, orderPublicId: string, input: UpdatePaymentRecordDto) {
    const store = await this.storeFor(user, publicId, 'finance.edit');
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.externalOrder.findFirst({ where: { publicId: orderPublicId, storeId: store.id }, select: { id: true, paymentStatus: true } });
      if (!order) throw new NotFoundException('External order not found');
      if (order.paymentStatus === input.status)
        return { paymentStatus: order.paymentStatus, unchanged: true, verifiedSettlement: false };
      if (!nextPaymentStatuses[order.paymentStatus]?.includes(input.status))
        throw new ConflictException('Invalid payment record transition');
      const changed = await tx.externalOrder.updateMany({ where: { id: order.id, paymentStatus: order.paymentStatus }, data: { paymentStatus: input.status } });
      if (changed.count !== 1) throw new ConflictException('Payment record changed; reload');
      await tx.auditLog.create({ data: { actorId: user.id, action: 'EXTERNAL_PAYMENT_RECORD_CHANGED', targetType: 'ExternalOrder',
        targetId: order.id, reason: input.reason, metadata: { from: order.paymentStatus, to: input.status, storeId: store.id,
          warning: 'Seller-recorded status; no gateway settlement verification' } } });
      return { paymentStatus: input.status, unchanged: false, verifiedSettlement: false };
    }, { isolationLevel: 'Serializable' }).catch(mapSerializationFailure);
  }

  async inventory(user: AuthenticatedUser, publicId: string) {
    const store = await this.storeFor(user, publicId, 'inventory.view');
    return this.inventoryFor(store.id);
  }

  private async inventoryFor(storeId: string) {
    const [variants, movements] = await Promise.all([
      this.prisma.listingVariant.findMany({ where: { sourceVariantId: null, listing: { storeId: storeId, deletedAt: null } }, take: 500,
        select: { id: true, sku: true, options: true, listing: { select: { publicId: true, nameUz: true, status: true } },
          inventory: { select: { available: true, reserved: true, version: true } } } }),
      this.prisma.stockMovement.findMany({ where: { storeId: storeId }, take: 100, orderBy: { createdAt: 'desc' },
        select: { id: true, variantId: true, type: true, availableDelta: true, reservedDelta: true, reason: true, createdAt: true } }),
    ]);
    return { variants, movements, lowStock: variants.filter((item) => (item.inventory?.available ?? 0) <= 3).length };
  }

  async adjustStock(user: AuthenticatedUser, publicId: string, input: AdjustStockDto) {
    const store = await this.storeFor(user, publicId, 'inventory.edit');
    if (input.delta === 0) throw new BadRequestException('Stock change cannot be zero');
    return this.prisma.$transaction(async (tx) => {
      const variant = await tx.listingVariant.findFirst({ where: { id: input.variantId, listing: { storeId: store.id } },
        select: { id: true, sourceVariantId: true, inventory: { select: { id: true } } } });
      if (!variant) throw new NotFoundException('Variant not found');
      if (variant.sourceVariantId) throw new BadRequestException('Qayta sotiladigan mahsulot stocki supplierga tegishli');
      if (!variant.inventory) throw new ConflictException('Variant has no inventory record yet');
      const changed = await tx.inventory.updateMany({ where: { variantId: variant.id, available: { gte: Math.max(0, -input.delta) } },
        data: { available: input.delta > 0 ? { increment: input.delta } : { decrement: -input.delta }, version: { increment: 1 } } });
      if (changed.count !== 1) throw new ConflictException('Insufficient available stock');
      await tx.stockMovement.create({ data: { storeId: store.id, variantId: variant.id, actorId: user.id,
        type: 'MANUAL_ADJUSTMENT', availableDelta: input.delta, reason: input.reason.trim() } });
      await tx.auditLog.create({ data: { actorId: user.id, action: 'STOCK_ADJUSTED', targetType: 'ListingVariant', targetId: variant.id,
        reason: input.reason, metadata: { delta: input.delta, storeId: store.id } } });
      return { adjusted: true };
    }, { isolationLevel: 'Serializable' });
  }

  async customers(user: AuthenticatedUser, publicId: string) {
    const store = await this.storeFor(user, publicId, 'customers.view');
    const customers = await this.prisma.storeCustomer.findMany({ where: { storeId: store.id }, take: 200,
      orderBy: { updatedAt: 'desc' }, include: { externalOrders: { where: { status: 'DELIVERED', paymentStatus: { not: 'REFUNDED' } },
        select: { totalMinor: true, createdAt: true } } } });
    return customers.map(({ phoneEncrypted, externalOrders, ...customer }) => {
      const spent = externalOrders.reduce((sum, order) => sum + order.totalMinor, 0n);
      return { ...customer, phone: phoneEncrypted ? this.crypto.decrypt(phoneEncrypted) : null,
        orderCount: externalOrders.length, totalSpentMinor: spent.toString(),
        averageOrderValueMinor: externalOrders.length ? (spent / BigInt(externalOrders.length)).toString() : '0',
        lastOrderAt: externalOrders.length ? new Date(Math.max(...externalOrders.map((order) => order.createdAt.getTime()))) : null,
        repeatCustomer: externalOrders.length > 1 };
    });
  }

  async customerOrders(user: AuthenticatedUser, publicId: string, customerPublicId: string) {
    const store = await this.storeFor(user, publicId, 'customers.view');
    const customer = await this.prisma.storeCustomer.findFirst({ where: { publicId: customerPublicId, storeId: store.id }, select: { id: true } });
    if (!customer) throw new NotFoundException('Customer not found');
    const orders = await this.prisma.externalOrder.findMany({ where: { storeId: store.id, customerId: customer.id },
      orderBy: { createdAt: 'desc' }, take: 100, select: { publicId: true, source: true, status: true, paymentStatus: true, totalMinor: true, createdAt: true } });
    return asJson(orders);
  }

  async updateCustomer(user: AuthenticatedUser, publicId: string, customerPublicId: string, input: UpdateCustomerDto) {
    const store = await this.storeFor(user, publicId, 'customers.edit');
    const customer = await this.prisma.storeCustomer.findFirst({ where: { publicId: customerPublicId, storeId: store.id }, select: { id: true } });
    if (!customer) throw new NotFoundException('Customer not found');
    const tags = input.tags?.map((tag) => tag.trim()).filter(Boolean);
    if (tags?.some((tag) => tag.length > 40)) throw new BadRequestException('Tag too long');
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.storeCustomer.update({ where: { id: customer.id }, data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.phone !== undefined ? { phoneHash: this.phoneHash(store.id, input.phone), phoneEncrypted: this.crypto.encrypt(input.phone) } : {}),
          ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
          ...(tags !== undefined ? { tags } : {}),
        } });
        await tx.auditLog.create({ data: { actorId: user.id, action: 'STORE_CUSTOMER_UPDATED', targetType: 'StoreCustomer', targetId: customer.id,
          metadata: { storeId: store.id, fields: Object.keys(input) } } });
      });
    } catch (error) {
      // (storeId, phoneHash) is unique: this phone already belongs to another
      // customer of the same store, which is the caller's conflict to resolve.
      if (isUniqueViolation(error)) throw new ConflictException('Another customer of this store already uses this phone number');
      throw error;
    }
    return { updated: true };
  }

  async createExpense(user: AuthenticatedUser, publicId: string, input: CreateExpenseDto) {
    const store = await this.storeFor(user, publicId, 'finance.edit');
    const occurredAt = input.occurredOn ? dayStart(input.occurredOn) : new Date();
    if (Number.isNaN(occurredAt.getTime()) || occurredAt.getTime() > Date.now() + 86_400_000) throw new BadRequestException('Invalid expense date');
    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.sellerExpense.create({ data: { storeId: store.id, amountMinor: BigInt(input.amountMinor),
        category: input.category, note: input.note?.trim() || null, occurredAt }, select: { id: true, publicId: true } });
      await tx.auditLog.create({ data: { actorId: user.id, action: 'SELLER_EXPENSE_CREATED', targetType: 'SellerExpense', targetId: expense.id,
        metadata: { storeId: store.id, category: input.category } } });
      return { publicId: expense.publicId };
    });
  }

  async finance(user: AuthenticatedUser, publicId: string, days = 30) {
    const store = await this.storeFor(user, publicId, 'finance.view');
    return this.financeFor(store.id, days);
  }

  private async financeFor(storeId: string, days = 30) {
    const since = dayStart(uzDay(new Date(Date.now() - (days - 1) * 86_400_000)));
    const [marketplace, external, expenses, marketplaceAll, externalAll, repeatGroups] = await Promise.all([
      this.prisma.order.findMany({ where: { storeId: storeId, status: 'COMPLETED', history: { some: { toStatus: 'COMPLETED', createdAt: { gte: since } } } }, take: 5000,
        select: { totalMinor: true, createdAt: true, history: { where: { toStatus: 'COMPLETED' }, orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
          items: { select: { quantity: true, snapshot: true } } } }),
      this.prisma.externalOrder.findMany({ where: { storeId: storeId, status: 'DELIVERED', history: { some: { toStatus: 'DELIVERED', createdAt: { gte: since } } } }, take: 5000,
        select: { source: true, totalMinor: true, costOfGoodsMinor: true, deliveryCostMinor: true, discountMinor: true,
          paymentStatus: true, createdAt: true, history: { where: { toStatus: 'DELIVERED' }, orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
          items: { select: { quantity: true, snapshot: true } } } }),
      this.prisma.sellerExpense.findMany({ where: { storeId: storeId, occurredAt: { gte: since } }, take: 5000,
        select: { publicId: true, amountMinor: true, category: true, note: true, occurredAt: true } }),
      this.prisma.order.groupBy({ by: ['status'], where: { storeId: storeId, createdAt: { gte: since } }, _count: true }),
      this.prisma.externalOrder.groupBy({ by: ['status'], where: { storeId: storeId, createdAt: { gte: since } }, _count: true }),
      this.prisma.externalOrder.groupBy({ by: ['customerId'], where: { storeId: storeId, status: 'DELIVERED', customerId: { not: null } }, _count: true }),
    ]);
    const marketplaceRevenue = marketplace.reduce((sum, order) => sum + order.totalMinor, 0n);
    const externalEarned = external.filter((order) => order.paymentStatus !== 'REFUNDED');
    const externalRevenue = externalEarned.reduce((sum, order) => sum + order.totalMinor, 0n);
    // A refund reverses recorded revenue, but a delivered order's product and courier costs
    // remain a seller cost until a separately recorded physical return/restock takes place.
    const costOfGoods = external.reduce((sum, order) => sum + order.costOfGoodsMinor, 0n);
    const deliveryCost = external.reduce((sum, order) => sum + order.deliveryCostMinor, 0n);
    const discounts = external.reduce((sum, order) => sum + order.discountMinor, 0n);
    const refundsMinor = external.filter((order) => order.paymentStatus === 'REFUNDED')
      .reduce((sum, order) => sum + order.totalMinor, 0n);
    const otherExpenses = expenses.reduce((sum, expense) => sum + expense.amountMinor, 0n);
    const bySource: Record<string, { orders: number; revenueMinor: string }> = {};
    for (const source of ['RESALLER', 'INSTAGRAM', 'TELEGRAM', 'OFFLINE', 'OTHER']) {
      const group = source === 'RESALLER' ? marketplace : externalEarned.filter((order) => order.source === source);
      bySource[source] = { orders: group.length, revenueMinor: group.reduce((sum, order) => sum + order.totalMinor, 0n).toString() };
    }
    const byDay = new Map<string, { orders: number; revenue: bigint }>();
    for (const order of [...marketplace, ...externalEarned]) {
      const day = uzDay(order.history[0]?.createdAt ?? order.createdAt);
      const current = byDay.get(day) ?? { orders: 0, revenue: 0n };
      current.orders += 1; current.revenue += order.totalMinor; byDay.set(day, current);
    }
    const totalOrders = marketplace.length + external.length;
    const productCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();
    for (const order of [...marketplace, ...external]) for (const item of order.items) {
      const snapshot = item.snapshot as Record<string, unknown>;
      const name = String(snapshot.listingName ?? snapshot.nameUz ?? 'Noma’lum');
      productCounts.set(name, (productCounts.get(name) ?? 0) + item.quantity);
      if (typeof snapshot.categoryId === 'string') categoryCounts.set(snapshot.categoryId, (categoryCounts.get(snapshot.categoryId) ?? 0) + item.quantity);
    }
    const categoryNames = await this.prisma.category.findMany({ where: { id: { in: [...categoryCounts.keys()] } }, select: { id: true, nameUz: true } });
    const categoryNameById = new Map(categoryNames.map((row) => [row.id, row.nameUz]));
    const cancelledCount = marketplaceAll.filter((row) => ['CANCELLED', 'REJECTED', 'TIMEOUT'].includes(row.status)).reduce((sum, row) => sum + row._count, 0) +
      externalAll.filter((row) => row.status === 'CANCELLED').reduce((sum, row) => sum + row._count, 0);
    const allCount = marketplaceAll.reduce((sum, row) => sum + row._count, 0) + externalAll.reduce((sum, row) => sum + row._count, 0);
    return { periodDays: days, currency: 'UZS', orderCount: totalOrders,
      revenueMinor: (marketplaceRevenue + externalRevenue).toString(), marketplaceRevenueMinor: marketplaceRevenue.toString(),
      externalRevenueMinor: externalRevenue.toString(), costOfGoodsKnownMinor: costOfGoods.toString(),
      sellerDeliveryCostMinor: deliveryCost.toString(), discountsMinor: discounts.toString(),
      refundsMinor: refundsMinor.toString(),
      otherExpensesMinor: otherExpenses.toString(), grossProfitEstimateExternalMinor: (externalRevenue - costOfGoods).toString(),
      netProfitEstimateExternalMinor: (externalRevenue - costOfGoods - deliveryCost - otherExpenses).toString(),
      averageOrderValueMinor: totalOrders ? ((marketplaceRevenue + externalRevenue) / BigInt(totalOrders)).toString() : '0',
      marketplaceProfitKnown: false, verifiedPaymentSettlement: false,
      refundsRecorded: external.filter((order) => order.paymentStatus === 'REFUNDED').length,
      cancellationRatePercent: allCount ? Math.round(cancelledCount / allCount * 1000) / 10 : 0,
      externalRefundRatePercent: external.length ? Math.round(external.filter((order) => order.paymentStatus === 'REFUNDED').length / external.length * 1000) / 10 : 0,
      repeatCustomers: repeatGroups.filter((row) => row._count > 1).length,
      topProducts: [...productCounts].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, quantity]) => ({ name, quantity })),
      topExternalCategories: [...categoryCounts].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([categoryId, quantity]) => ({ name: categoryNameById.get(categoryId) ?? 'Noma’lum kategoriya', quantity })),
      bySource, byDay: [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([day, value]) => ({ day, orders: value.orders, revenueMinor: value.revenue.toString() })),
      expenses: asJson(expenses), truncated: marketplace.length === 5000 || external.length === 5000 || expenses.length === 5000 };
  }

  async dashboard(user: AuthenticatedUser, publicId: string) {
    const store = await this.storeFor(user, publicId, 'analytics.view', 'finance.view', 'orders.view');
    const [finance, financeToday, externalStatuses, marketplaceStatuses, variants, recent] = await Promise.all([
      this.financeFor(store.id, 30),
      this.financeFor(store.id, 1),
      this.prisma.externalOrder.groupBy({ by: ['status'], where: { storeId: store.id }, _count: true }),
      this.prisma.order.groupBy({ by: ['status'], where: { OR: [{ storeId: store.id, fulfillmentStoreId: null }, { fulfillmentStoreId: store.id }] }, _count: true }),
      this.prisma.listingVariant.findMany({ where: { listing: { storeId: store.id, deletedAt: null }, inventory: { available: { lte: 3 } } }, take: 20,
        select: { id: true, sku: true, listing: { select: { nameUz: true } }, inventory: { select: { available: true } } } }),
      this.ordersFor(store.id),
    ]);
    const todaySales = finance.byDay.find((row) => row.day === uzDay(new Date()));
    const count = (status: string) => (externalStatuses.find((item) => item.status === status)?._count ?? 0) +
      (marketplaceStatuses.find((item) => item.status === status)?._count ?? 0);
    return { store: { publicId: store.publicId, nameUz: store.nameUz },
      todayRevenueMinor: todaySales?.revenueMinor ?? '0', todayOrderCount: todaySales?.orders ?? 0,
      todayProfitEstimateExternalMinor: financeToday.netProfitEstimateExternalMinor,
      newOrders: count('NEW') + count('WAITING_SELLER'), preparingOrders: count('PREPARING'),
      deliveredOrders: financeToday.orderCount, lowStockAlerts: variants,
      recentOrders: recent.slice(0, 10), salesChart: finance.byDay,
      topSellingProduct: finance.topProducts[0] ?? null,
      profitDisclosure: 'Only external-order estimated profit has known entered costs; marketplace profit and actual settlement are unknown.' };
  }

  async assistantContext(user: AuthenticatedUser, publicId: string) {
    const store = await this.storeFor(user, publicId, 'analytics.view', 'finance.view', 'orders.view', 'inventory.view');
    const [finance, stock, recentOrders] = await Promise.all([this.financeFor(store.id, 7), this.inventoryFor(store.id), this.ordersFor(store.id)]);
    return { storePublicId: store.publicId, periodDays: 7,
      revenueMinor: finance.revenueMinor, externalProfitEstimateMinor: finance.netProfitEstimateExternalMinor,
      marketplaceProfitKnown: false, verifiedPaymentSettlement: false,
      bySource: finance.bySource, byDay: finance.byDay,
      orderSummary: { count: finance.orderCount, recentStatuses: recentOrders.slice(0, 20).map((order) => ({ source: order.source, status: order.status })) },
      customerSummary: { repeatExternalCustomers: finance.repeatCustomers },
      topProducts: finance.topProducts,
      lowStock: stock.variants.filter((item) => (item.inventory?.available ?? 0) <= 3)
        .map((item) => ({ name: item.listing.nameUz, sku: item.sku, available: item.inventory?.available ?? 0 })),
      // No customer phone, address, notes, document number or raw order messages are sent to an assistant.
      personalDataIncluded: false, actionAuthority: 'READ_ONLY' };
  }
}
