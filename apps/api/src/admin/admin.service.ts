import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../infrastructure/prisma.service.js';
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

@Injectable()
export class AdminService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async queue() {
    const [stores, listings, verifications, disputes, securityEvents] =
      await Promise.all([
        this.prisma.store.findMany({
          where: { status: 'PENDING_REVIEW' },
          take: 50,
          orderBy: { createdAt: 'asc' },
          select: {
            publicId: true,
            username: true,
            nameUz: true,
            createdAt: true,
          },
        }),
        this.prisma.listing.findMany({
          where: { status: 'PENDING_REVIEW' },
          take: 50,
          orderBy: { createdAt: 'asc' },
          select: {
            publicId: true,
            nameUz: true,
            store: { select: { username: true } },
            createdAt: true,
          },
        }),
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
      stores,
      listings,
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
      if (input.status === 'ACTIVE' && !store.sellerProfile.verifiedAt)
        throw new ConflictException(
          'Seller identity must be verified before activation',
        );
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
      const listing = await tx.listing.findUnique({ where: { publicId } });
      if (!listing) throw new NotFoundException('Listing not found');
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
