import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../infrastructure/prisma.service.js';
import { EndpointCryptoService } from '../notifications/endpoint-crypto.service.js';
import type { AuthenticatedUser } from '../auth/session.guard.js';
import type {
  DecideDisputeDto,
  ModerateListingDto,
  ModerateQuestionReportDto,
  ModerateReviewDto,
  ModerateStoreDto,
  ModerateUserDto,
  ModerateVerificationDto,
  ResolveSecurityEventDto,
  UpdateUserRolesDto,
} from './admin.dto.js';
import { syncResellerEarning } from '../resale/resale-sync.js';

@Injectable()
export class AdminService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EndpointCryptoService) private readonly crypto: EndpointCryptoService) {}
  async sellerLoginHistory(actor: AuthenticatedUser) {
    const rows = await this.prisma.session.findMany({
      where: { user: { sellerProfile: { isNot: null } }, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, expiresAt: true, revokedAt: true, ipEncrypted: true, userAgent: true,
        user: { select: { username: true, publicId: true, sellerProfile: { select: { verifiedAt: true, verification: { select: { legalName: true, phoneMasked: true, documentNumberMasked: true } } } } } } },
    });
    await this.prisma.auditLog.create({ data: { actorId: actor.id, action: 'SELLER_LOGIN_HISTORY_VIEWED', targetType: 'Session', targetId: actor.id, metadata: { resultCount: rows.length } } });
    return rows.map(({ ipEncrypted, ...row }) => ({ ...row, ip: ipEncrypted ? this.crypto.decrypt(ipEncrypted) : null }));
  }
  async sellerPrivateDetails(actor: AuthenticatedUser, publicId: string, reason: string) {
    const seller = await this.prisma.user.findUnique({ where: { publicId }, select: {
      id: true, username: true, sellerProfile: { select: { verification: { select: {
        legalName: true, documentType: true, documentNumberEncrypted: true,
        phoneEncrypted: true, residenceAddressEncrypted: true,
      } } } },
    } });
    if (!seller?.sellerProfile?.verification) throw new NotFoundException('Seller verification not found');
    await this.prisma.auditLog.create({ data: { actorId: actor.id, action: 'SELLER_PRIVATE_DETAILS_VIEWED', targetType: 'User', targetId: seller.id, reason } });
    const details = seller.sellerProfile.verification;
    return { username: seller.username, legalName: details.legalName, documentType: details.documentType,
      documentNumber: details.documentNumberEncrypted ? this.crypto.decrypt(details.documentNumberEncrypted) : null,
      phone: details.phoneEncrypted ? this.crypto.decrypt(details.phoneEncrypted) : null,
      residenceAddress: details.residenceAddressEncrypted ? this.crypto.decrypt(details.residenceAddressEncrypted) : null };
  }
  async queue() {
    const [verifications, disputes, securityEvents] =
      await Promise.all([
        this.prisma.sellerVerification.findMany({
          where: {
            status: 'PENDING_REVIEW',
            documentStorageKey: { not: null },
          },
          take: 50,
          orderBy: { submittedAt: 'asc' },
          select: {
            id: true,
            legalName: true,
            documentType: true,
            documentNumberMasked: true,
            documentStorageKey: true,
            submittedAt: true,
            sellerProfile: {
              select: { user: { select: { publicId: true, username: true } } },
            },
          },
        }),
        this.prisma.dispute.count({
          where: { status: { notIn: ['DECIDED', 'CLOSED'] } },
        }),
        this.prisma.securityEvent.count({
          where: { createdAt: { gte: new Date(Date.now() - 86_400_000) } },
        }),
      ]);
    return {
      verifications: verifications.map(
        ({ documentStorageKey, ...verification }) => ({
          ...verification,
          documentAvailable: Boolean(documentStorageKey),
        }),
      ),
      openDisputes: disputes,
      securityEvents24h: securityEvents,
    };
  }
  async overview() {
    const today = new Date();
    const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const thirtyDaysAgo = new Date(todayUtc.getTime() - 29 * 86_400_000);
    const [visitorsToday, visitors30Days, pageViews30Days, ordersPlaced, ordersCompleted, storesActive, listingsPublished, listingsTotal, recentAudit, recentOrders, recentListings] = await Promise.all([
      this.prisma.siteVisit.count({ where: { day: todayUtc } }),
      this.prisma.siteVisit.count({ where: { day: { gte: thirtyDaysAgo } } }),
      this.prisma.siteVisit.aggregate({ where: { day: { gte: thirtyDaysAgo } }, _sum: { pageViews: true } }),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: 'COMPLETED' } }),
      this.prisma.store.count({ where: { status: 'ACTIVE' } }),
      this.prisma.listing.count({ where: { status: 'ACTIVE' } }),
      this.prisma.listing.count(),
      this.prisma.auditLog.findMany({ take: 15, orderBy: { createdAt: 'desc' }, select: { id: true, action: true, targetType: true, reason: true, createdAt: true, actor: { select: { username: true } } } }),
      this.prisma.order.findMany({ take: 10, orderBy: { createdAt: 'desc' }, select: { publicId: true, displayId: true, status: true, createdAt: true, buyer: { select: { username: true } }, store: { select: { username: true } } } }),
      this.prisma.listing.findMany({ take: 10, orderBy: { createdAt: 'desc' }, select: { publicId: true, nameUz: true, status: true, createdAt: true, store: { select: { username: true } } } }),
    ]);
    return {
      metrics: { visitorsToday, visitorDays30: visitors30Days, pageViews30: pageViews30Days._sum.pageViews ?? 0, ordersPlaced, ordersCompleted, storesActive, listingsPublished, listingsTotal },
      recentAudit,
      recentOrders,
      recentListings,
    };
  }
  async allListings(page: number) {
    const pageSize = 50;
    const [items, total] = await Promise.all([
      this.prisma.listing.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { publicId: true, nameUz: true, status: true, createdAt: true, store: { select: { username: true, nameUz: true, status: true } } },
      }),
      this.prisma.listing.count(),
    ]);
    return { items, total, page, pageSize };
  }
  async moderateStore(
    actor: AuthenticatedUser,
    publicId: string,
    input: ModerateStoreDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const store = await tx.store.findUnique({
        where: { publicId },
        include: { sellerProfile: { select: { verifiedAt: true } } },
      });
      if (!store) throw new NotFoundException('Store not found');
      if (input.status === 'ACTIVE') {
        if (!store.sellerProfile.verifiedAt)
          throw new ConflictException(
            'Seller identity must be verified before activation',
          );
        if (!['PENDING_REVIEW', 'RESTRICTED', 'SUSPENDED'].includes(store.status))
          throw new ConflictException('Only a restricted store can be restored by an admin');
      }
      const updated = await tx.store.update({
        where: { id: store.id },
        data: { status: input.status },
        select: { publicId: true, status: true },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'STORE_STATUS_CHANGED',
          targetType: 'Store',
          targetId: store.id,
          reason: input.reason,
          metadata: { from: store.status, to: input.status },
        },
      });
      return updated;
    });
  }
  async moderateListing(
    actor: AuthenticatedUser,
    publicId: string,
    input: ModerateListingDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({
        where: { publicId },
        include: { store: { include: { sellerProfile: { select: { verifiedAt: true } } } } },
      });
      if (!listing) throw new NotFoundException('Listing not found');
      if (input.status === 'ACTIVE') {
        if (!['PENDING_REVIEW', 'RESTRICTED', 'REJECTED'].includes(listing.status))
          throw new ConflictException('Only a restricted listing can be restored by an admin');
        if (listing.store.status !== 'ACTIVE' || !listing.store.sellerProfile.verifiedAt)
          throw new ConflictException('Store must be active before listing approval');
      }
      const updated = await tx.listing.update({
        where: { id: listing.id },
        data: { status: input.status },
        select: { publicId: true, status: true },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'LISTING_STATUS_CHANGED',
          targetType: 'Listing',
          targetId: listing.id,
          reason: input.reason,
          metadata: { from: listing.status, to: input.status },
        },
      });
      return updated;
    });
  }
  async moderateVerification(
    actor: AuthenticatedUser,
    id: string,
    input: ModerateVerificationDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const verification = await tx.sellerVerification.findUnique({
        where: { id },
      });
      if (!verification) throw new NotFoundException('Verification not found');
      if (
        input.status === 'APPROVED' &&
        (verification.status !== 'PENDING_REVIEW' || !verification.documentStorageKey)
      )
        throw new ConflictException(
          'Verification document must be submitted before approval',
        );
      const reviewedAt = new Date();
      const updated = await tx.sellerVerification.update({
        where: { id },
        data: { status: input.status, reviewedAt, reviewReason: input.reason },
        select: { id: true, status: true, reviewedAt: true },
      });
      if (input.status === 'APPROVED')
        await tx.sellerProfile.update({
          where: { id: verification.sellerProfileId },
          data: { verifiedAt: reviewedAt, trustBadge: 'IDENTITY_VERIFIED' },
        });
      if (input.status === 'REJECTED')
        await tx.sellerProfile.update({
          where: { id: verification.sellerProfileId },
          data: { verifiedAt: null, trustBadge: 'NEW' },
        });
      if (input.status === 'REJECTED')
        await tx.store.updateMany({
          where: { sellerProfileId: verification.sellerProfileId, status: 'ACTIVE' },
          data: { status: 'RESTRICTED' },
        });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'SELLER_VERIFICATION_DECIDED',
          targetType: 'SellerVerification',
          targetId: id,
          reason: input.reason,
          metadata: { from: verification.status, to: input.status },
        },
      });
      return updated;
    });
  }
  audit() {
    return this.prisma.auditLog.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        reason: true,
        metadata: true,
        createdAt: true,
        actor: { select: { publicId: true, username: true } },
      },
    });
  }
  async orders() {
    const rows = await this.prisma.order.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        buyer: { select: { publicId: true, username: true } },
        store: { select: { publicId: true, username: true, nameUz: true } },
        _count: { select: { items: true, changes: true } },
      },
    });
    return rows.map((order) => ({ ...order, totalMinor: order.totalMinor.toString(), subtotalMinor: order.subtotalMinor.toString(), discountMinor: order.discountMinor.toString() }));
  }
  riskEvents() {
    return this.prisma.riskEvent.findMany({ take: 200, orderBy: [{ reviewedAt: 'asc' }, { score: 'desc' }, { createdAt: 'desc' }] });
  }
  async reviewRisk(actor: AuthenticatedUser, id: string, resolution: string) {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.riskEvent.findUnique({ where: { id } });
      if (!event) throw new NotFoundException('Risk event not found');
      if (event.reviewedAt) throw new ConflictException('Risk event was already reviewed');
      const updated = await tx.riskEvent.update({ where: { id }, data: { reviewedAt: new Date(), metadata: { ...(event.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata) ? event.metadata : {}), resolution } }, select: { id: true, reviewedAt: true } });
      await tx.auditLog.create({ data: { actorId: actor.id, action: 'RISK_EVENT_REVIEWED', targetType: 'RiskEvent', targetId: id, reason: resolution, metadata: { score: event.score, signal: event.signal } } });
      return updated;
    });
  }

  questionReports() {
    return this.prisma.questionReport.findMany({
      where: { status: 'OPEN' },
      take: 100,
      orderBy: { createdAt: 'asc' },
      include: {
        reporter: { select: { publicId: true, username: true } },
        question: {
          select: {
            id: true,
            body: true,
            store: { select: { publicId: true, username: true } },
            author: { select: { publicId: true, username: true } },
          },
        },
      },
    });
  }

  async moderateQuestionReport(
    actor: AuthenticatedUser,
    id: string,
    input: ModerateQuestionReportDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.questionReport.findUnique({ where: { id } });
      if (!report) throw new NotFoundException('Question report not found');
      if (report.status !== 'OPEN')
        throw new ConflictException('Question report was already reviewed');
      const updated = await tx.questionReport.update({
        where: { id },
        data: {
          status: input.status,
          resolution: input.resolution,
          reviewedAt: new Date(),
        },
        select: { id: true, status: true, reviewedAt: true },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'QUESTION_REPORT_DECIDED',
          targetType: 'QuestionReport',
          targetId: id,
          reason: input.resolution,
          metadata: { outcome: input.status },
        },
      });
      return updated;
    });
  }

  disputes() {
    return this.prisma.dispute.findMany({
      where: { status: { notIn: ['DECIDED', 'CLOSED'] } },
      take: 100,
      orderBy: { createdAt: 'asc' },
      include: {
        order: {
          select: {
            publicId: true,
            displayId: true,
            status: true,
            buyer: { select: { publicId: true, username: true } },
            store: { select: { publicId: true, username: true, nameUz: true } },
          },
        },
        evidence: {
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            sizeBytes: true,
            createdAt: true,
          },
        },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async decideDispute(
    actor: AuthenticatedUser,
    id: string,
    input: DecideDisputeDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const dispute = await tx.dispute.findUnique({
        where: { id },
        include: { decision: true },
      });
      if (!dispute) throw new NotFoundException('Dispute not found');
      if (dispute.decision)
        throw new ConflictException('Dispute decision is immutable');
      const decision = await tx.disputeDecision.create({
        data: {
          disputeId: id,
          actorId: actor.id,
          outcome: input.outcome,
          reason: input.reason,
        },
      });
      await tx.dispute.update({
        where: { id },
        data: {
          status: 'DECIDED',
          events: {
            create: {
              actorId: actor.id,
              type: 'DECIDED',
              payload: { outcome: input.outcome, reason: input.reason },
            },
          },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'DISPUTE_DECIDED',
          targetType: 'Dispute',
          targetId: id,
          reason: input.reason,
          metadata: { outcome: input.outcome },
        },
      });
      // Resale earnings follow the decision. A seller win releases the margin
      // only if the goods were actually delivered; otherwise it stays on hold.
      const delivered = await tx.orderStatusHistory.count({
        where: { orderId: dispute.orderId, toStatus: { in: ['DELIVERED', 'COMPLETED'] } },
      });
      const event = input.outcome === 'BUYER' ? 'DISPUTE_BUYER'
        : (input.outcome === 'SELLER' || input.outcome === 'NO_ACTION') && delivered ? 'DISPUTE_SELLER'
        : 'DISPUTE_PARTIAL';
      await syncResellerEarning(tx, dispute.orderId, event);
      return decision;
    });
  }

  users() {
    return this.prisma.user.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: {
        publicId: true,
        username: true,
        roles: true,
        accountStatus: true,
        accountStatusReason: true,
        accountStatusChangedAt: true,
        createdAt: true,
        _count: {
          select: { sessions: true, orders: true, securityEvents: true },
        },
      },
    });
  }

  async moderateUser(
    actor: AuthenticatedUser,
    publicId: string,
    input: ModerateUserDto,
  ) {
    if (actor.publicId === publicId && input.status !== 'ACTIVE')
      throw new ConflictException(
        'You cannot suspend or close your own account',
      );
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { publicId } });
      if (!user) throw new NotFoundException('User not found');
      const updated = await tx.user.update({
        where: { id: user.id },
        data: {
          accountStatus: input.status,
          accountStatusReason: input.reason,
          accountStatusChangedAt: new Date(),
        },
        select: { publicId: true, username: true, accountStatus: true },
      });
      if (input.status !== 'ACTIVE')
        await tx.session.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'USER_STATUS_CHANGED',
          targetType: 'User',
          targetId: user.id,
          reason: input.reason,
          metadata: { from: user.accountStatus, to: input.status },
        },
      });
      return updated;
    });
  }

  async updateUserRoles(
    actor: AuthenticatedUser,
    publicId: string,
    input: UpdateUserRolesDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { publicId } });
      if (!user) throw new NotFoundException('User not found');
      if (
        user.roles.includes('SUPER_ADMIN') &&
        !input.roles.includes('SUPER_ADMIN')
      ) {
        const count = await tx.user.count({
          where: { roles: { has: 'SUPER_ADMIN' }, accountStatus: 'ACTIVE' },
        });
        if (count <= 1)
          throw new ConflictException(
            'The last active super admin cannot be removed',
          );
      }
      const updated = await tx.user.update({
        where: { id: user.id },
        data: { roles: input.roles },
        select: { publicId: true, username: true, roles: true },
      });
      await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'USER_ROLES_CHANGED',
          targetType: 'User',
          targetId: user.id,
          reason: input.reason,
          metadata: { from: user.roles, to: input.roles },
        },
      });
      return updated;
    });
  }

  reviews() {
    return this.prisma.review.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: {
            publicId: true,
            displayId: true,
            buyer: { select: { publicId: true, username: true } },
            store: { select: { publicId: true, username: true, nameUz: true } },
          },
        },
        moderatedBy: { select: { publicId: true, username: true } },
      },
    });
  }

  async moderateReview(
    actor: AuthenticatedUser,
    id: string,
    input: ModerateReviewDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.review.findUnique({ where: { id } });
      if (!review) throw new NotFoundException('Review not found');
      const updated = await tx.review.update({
        where: { id },
        data: {
          status: input.status,
          moderationReason: input.reason,
          moderatedAt: new Date(),
          moderatedById: actor.id,
        },
        select: { id: true, status: true, moderatedAt: true },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'REVIEW_MODERATED',
          targetType: 'Review',
          targetId: id,
          reason: input.reason,
          metadata: { from: review.status, to: input.status },
        },
      });
      return updated;
    });
  }

  securityEvents() {
    return this.prisma.securityEvent.findMany({
      take: 200,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { publicId: true, username: true } },
        reviewedBy: { select: { publicId: true, username: true } },
      },
    });
  }

  async resolveSecurityEvent(
    actor: AuthenticatedUser,
    id: string,
    input: ResolveSecurityEventDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.securityEvent.findUnique({ where: { id } });
      if (!event) throw new NotFoundException('Security event not found');
      if (event.reviewedAt)
        throw new ConflictException('Security event was already resolved');
      const updated = await tx.securityEvent.update({
        where: { id },
        data: {
          reviewedAt: new Date(),
          reviewedById: actor.id,
          resolution: input.resolution,
        },
        select: { id: true, reviewedAt: true, resolution: true },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'SECURITY_EVENT_RESOLVED',
          targetType: 'SecurityEvent',
          targetId: id,
          reason: input.resolution,
          metadata: { severity: event.severity, type: event.type },
        },
      });
      return updated;
    });
  }
}
