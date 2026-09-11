import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../infrastructure/prisma.service.js';
import type { AuthenticatedUser } from '../auth/session.guard.js';
import type { ModerateListingDto, ModerateStoreDto, ModerateVerificationDto } from './admin.dto.js';

@Injectable()
export class AdminService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async queue() {
    const [stores, listings, verifications, disputes, securityEvents] = await Promise.all([
      this.prisma.store.findMany({ where: { status: 'PENDING_REVIEW' }, take: 50, orderBy: { createdAt: 'asc' }, select: { publicId: true, username: true, nameUz: true, createdAt: true } }),
      this.prisma.listing.findMany({ where: { status: 'PENDING_REVIEW' }, take: 50, orderBy: { createdAt: 'asc' }, select: { publicId: true, nameUz: true, store: { select: { username: true } }, createdAt: true } }),
      this.prisma.sellerVerification.findMany({ where: { status: 'PENDING_REVIEW', documentStorageKey: { not: null } }, take: 50, orderBy: { submittedAt: 'asc' }, select: { id: true, legalName: true, documentType: true, documentNumberMasked: true, documentStorageKey: true, submittedAt: true, sellerProfile: { select: { user: { select: { publicId: true, username: true } } } } } }),
      this.prisma.dispute.count({ where: { status: { notIn: ['DECIDED', 'CLOSED'] } } }),
      this.prisma.securityEvent.count({ where: { createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
    ]);
    return { stores, listings, verifications: verifications.map(({ documentStorageKey, ...verification }) => ({ ...verification, documentAvailable: Boolean(documentStorageKey) })), openDisputes: disputes, securityEvents24h: securityEvents };
  }
  async moderateStore(actor: AuthenticatedUser, publicId: string, input: ModerateStoreDto) {
    return this.prisma.$transaction(async (tx) => {
      const store = await tx.store.findUnique({ where: { publicId }, include: { sellerProfile: { select: { verifiedAt: true } } } }); if (!store) throw new NotFoundException('Store not found');
      if (input.status === 'ACTIVE' && !store.sellerProfile.verifiedAt) throw new ConflictException('Seller identity must be verified before activation');
      const updated = await tx.store.update({ where: { id: store.id }, data: { status: input.status }, select: { publicId: true, status: true } });
      await tx.auditLog.create({ data: { actorId: actor.id, action: 'STORE_STATUS_CHANGED', targetType: 'Store', targetId: store.id, reason: input.reason, metadata: { from: store.status, to: input.status } } });
      return updated;
    });
  }
  async moderateListing(actor: AuthenticatedUser, publicId: string, input: ModerateListingDto) {
    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({ where: { publicId } }); if (!listing) throw new NotFoundException('Listing not found');
      const updated = await tx.listing.update({ where: { id: listing.id }, data: { status: input.status }, select: { publicId: true, status: true } });
      await tx.auditLog.create({ data: { actorId: actor.id, action: 'LISTING_STATUS_CHANGED', targetType: 'Listing', targetId: listing.id, reason: input.reason, metadata: { from: listing.status, to: input.status } } });
      return updated;
    });
  }
  async moderateVerification(actor: AuthenticatedUser, id: string, input: ModerateVerificationDto) {
    return this.prisma.$transaction(async (tx) => {
      const verification = await tx.sellerVerification.findUnique({ where: { id } });
      if (!verification) throw new NotFoundException('Verification not found');
      const reviewedAt = new Date();
      const updated = await tx.sellerVerification.update({ where: { id }, data: { status: input.status, reviewedAt, reviewReason: input.reason }, select: { id: true, status: true, reviewedAt: true } });
      if (input.status === 'APPROVED') await tx.sellerProfile.update({ where: { id: verification.sellerProfileId }, data: { verifiedAt: reviewedAt, trustBadge: 'IDENTITY_VERIFIED' } });
      if (input.status === 'REJECTED') await tx.sellerProfile.update({ where: { id: verification.sellerProfileId }, data: { verifiedAt: null, trustBadge: 'NEW' } });
      await tx.auditLog.create({ data: { actorId: actor.id, action: 'SELLER_VERIFICATION_DECIDED', targetType: 'SellerVerification', targetId: id, reason: input.reason, metadata: { from: verification.status, to: input.status } } });
      return updated;
    });
  }
  audit() { return this.prisma.auditLog.findMany({ take: 100, orderBy: { createdAt: 'desc' }, select: { id: true, action: true, targetType: true, targetId: true, reason: true, metadata: true, createdAt: true, actor: { select: { publicId: true, username: true } } } }); }
}
