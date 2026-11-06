import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { OperationsService } from './operations.service.js';
import type { PrismaService } from '../infrastructure/prisma.service.js';
import type { AuthenticatedUser } from '../auth/session.guard.js';

const formerMember: AuthenticatedUser = { id: 'former-member', publicId: 'former-public', username: 'former', roles: ['SELLER'], createdAt: new Date() };
function fixture() {
  const order = { publicId: 'order-public', buyerId: 'buyer', fulfillmentStore: null,
    conversation: { id: 'conversation' }, store: { sellerProfile: { userId: 'owner' }, members: [{ userId: formerMember.id }] } };
  const prisma = { order: { findUnique: vi.fn().mockResolvedValue(order) }, message: { findMany: vi.fn(), create: vi.fn() } };
  return { prisma, service: new OperationsService(prisma as unknown as PrismaService) };
}
describe('retired store membership grants no order access', () => {
  it('denies order details even when the old StoreMember record remains', async () => {
    const { service } = fixture();
    await expect(service.order(formerMember, 'order-public')).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('denies reading and sending order messages', async () => {
    const { service, prisma } = fixture();
    await expect(service.messages(formerMember, 'order-public')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.message(formerMember, 'order-public', 'Unauthorized')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.message.findMany).not.toHaveBeenCalled();
    expect(prisma.message.create).not.toHaveBeenCalled();
  });
});


describe('buyer cannot perform owner fulfillment actions', () => {
  it.each(['ACCEPTED', 'PREPARING', 'READY', 'SHIPPED', 'DELIVERED'] as const)('denies buyer transition to %s before any writes', async (to) => {
    const buyer: AuthenticatedUser = {...formerMember, id:'buyer', roles:['BUYER']};
    const tx = { order: {findUnique:vi.fn().mockResolvedValue({buyerId:'buyer',status:'ACCEPTED',store:{sellerProfile:{userId:'owner'},members:[]},fulfillmentStore:null,reservations:[]}),update:vi.fn()} };
    const prisma = {$transaction:vi.fn(async(callback:(tx:unknown)=>Promise<unknown>)=>callback(tx))};
    const service = new OperationsService(prisma as unknown as PrismaService);
    await expect(service.transition(buyer,'order-public',to)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.order.update).not.toHaveBeenCalled();
  });
});
