import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { PrismaService } from '../infrastructure/prisma.service.js';
import type { AuthenticatedUser } from '../auth/session.guard.js';
import { detectSafeImage } from './media-signature.js';
import { detectVerificationDocument } from './verification-document.js';
import { processListingImage } from './image-processor.js';
import { MediaStorageService } from './media-storage.service.js';
import { MalwareScannerService } from './malware-scanner.service.js';

@Injectable()
export class MediaService {
  private readonly privateRoot = resolve(
    process.env.PRIVATE_MEDIA_ROOT ?? './data/private-media',
  );
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MediaStorageService) private readonly storage: MediaStorageService,
    @Inject(MalwareScannerService) private readonly scanner: MalwareScannerService,
  ) {}

  async uploadListingImage(
    userId: string,
    listingPublicId: string,
    bytes: Buffer,
  ) {
    await this.scanner.assertClean(bytes);
    const listing = await this.prisma.listing.findUnique({
      where: { publicId: listingPublicId },
      include: {
        store: { include: { sellerProfile: true, members: true } },
        media: { select: { position: true } },
      },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (
      listing.store.sellerProfile.userId !== userId &&
      !listing.store.members.some((member) => member.userId === userId)
    )
      throw new ForbiddenException('Listing access denied');
    if (listing.media.length >= 10)
      throw new ConflictException('A listing can contain at most 10 images');
    const image = detectSafeImage(bytes);
    if (!image)
      throw new UnsupportedMediaTypeException(
        'Only valid JPEG, PNG, and WebP images are accepted',
      );
    let processed;
    try {
      processed = await processListingImage(bytes);
    } catch {
      throw new UnsupportedMediaTypeException(
        'Image could not be decoded safely',
      );
    }
    const storageKey = `${randomBytes(24).toString('hex')}.${processed.extension}`;
    const thumbnailStorageKey = `${randomBytes(24).toString('hex')}.${processed.extension}`;
    await this.storage.put(storageKey, processed.image, processed.mimeType);
    try {
      await this.storage.put(
        thumbnailStorageKey,
        processed.thumbnail,
        processed.mimeType,
      );
      const position =
        listing.media.reduce(
          (highest, item) => Math.max(highest, item.position),
          -1,
        ) + 1;
      const media = await this.prisma.listingMedia.create({
        data: {
          listingId: listing.id,
          storageKey,
          thumbnailStorageKey,
          mimeType: processed.mimeType,
          width: processed.width,
          height: processed.height,
          position,
        },
        select: {
          id: true,
          storageKey: true,
          thumbnailStorageKey: true,
          mimeType: true,
          width: true,
          height: true,
          position: true,
        },
      });
      return {
        ...media,
        url: `/api/v1/media/${storageKey}`,
        thumbnailUrl: `/api/v1/media/${thumbnailStorageKey}`,
      };
    } catch (error) {
      await Promise.all([
        this.storage.delete(storageKey),
        this.storage.delete(thumbnailStorageKey),
      ]);
      throw error;
    }
  }

  async publicImage(storageKey: string) {
    if (!/^[a-f0-9]{48}\.(jpg|png|webp)$/.test(storageKey))
      throw new NotFoundException('Media not found');
    const media = await this.prisma.listingMedia.findFirst({
      where: { OR: [{ storageKey }, { thumbnailStorageKey: storageKey }] },
      include: {
        listing: {
          select: {
            status: true,
            deletedAt: true,
            store: { select: { status: true } },
          },
        },
      },
    });
    if (
      !media ||
      media.listing.deletedAt ||
      media.listing.status !== 'ACTIVE' ||
      media.listing.store.status !== 'ACTIVE'
    )
      throw new NotFoundException('Media not found');
    return {
      bytes: await this.storage.get(storageKey),
      mimeType: media.mimeType,
    };
  }

  async uploadVerificationDocument(userId: string, bytes: Buffer) {
    await this.scanner.assertClean(bytes);
    const verification = await this.prisma.sellerVerification.findFirst({
      where: { sellerProfile: { userId } },
    });
    if (!verification)
      throw new NotFoundException(
        'Verification details are required before document upload',
      );
    const document = detectVerificationDocument(bytes);
    if (!document)
      throw new UnsupportedMediaTypeException(
        'Only valid PDF, JPEG, and PNG documents are accepted',
      );
    await mkdir(this.privateRoot, { recursive: true });
    const storageKey = `${randomBytes(24).toString('hex')}.${document.extension}`;
    const filePath = resolve(this.privateRoot, storageKey);
    await writeFile(filePath, bytes, { flag: 'wx', mode: 0o600 });
    const oldKey = verification.documentStorageKey;
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const row = await tx.sellerVerification.update({
          where: { id: verification.id },
          data: {
            documentStorageKey: storageKey,
            status: 'PENDING_REVIEW',
            submittedAt: new Date(),
            reviewedAt: null,
            reviewReason: null,
          },
          select: { id: true, status: true, submittedAt: true },
        });
        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: 'VERIFICATION_DOCUMENT_UPLOADED',
            targetType: 'SellerVerification',
            targetId: verification.id,
            metadata: { mimeType: document.mimeType },
          },
        });
        return row;
      });
      if (oldKey && /^[a-f0-9]{48}\.(pdf|jpg|png)$/.test(oldKey))
        await unlink(resolve(this.privateRoot, oldKey)).catch(() => undefined);
      return updated;
    } catch (error) {
      await unlink(filePath).catch(() => undefined);
      throw error;
    }
  }

  async verificationDocument(actorId: string, verificationId: string) {
    const verification = await this.prisma.sellerVerification.findUnique({
      where: { id: verificationId },
      select: { id: true, documentStorageKey: true },
    });
    if (
      !verification?.documentStorageKey ||
      !/^[a-f0-9]{48}\.(pdf|jpg|png)$/.test(verification.documentStorageKey)
    )
      throw new NotFoundException('Verification document not found');
    const extension = verification.documentStorageKey.split('.').at(-1);
    const mimeType =
      extension === 'pdf'
        ? 'application/pdf'
        : extension === 'png'
          ? 'image/png'
          : 'image/jpeg';
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'VERIFICATION_DOCUMENT_VIEWED',
        targetType: 'SellerVerification',
        targetId: verification.id,
      },
    });
    return {
      bytes: await readFile(
        resolve(this.privateRoot, verification.documentStorageKey),
      ),
      mimeType,
    };
  }

  async uploadMessageAttachment(
    user: AuthenticatedUser,
    messageId: string,
    bytes: Buffer,
    fileName: string,
  ) {
    await this.scanner.assertClean(bytes);
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          include: {
            order: {
              include: {
                store: { include: { sellerProfile: true, members: true } },
              },
            },
          },
        },
      },
    });
    if (!message?.conversation.order)
      throw new NotFoundException('Order message not found');
    const order = message.conversation.order;
    const allowed =
      order.buyerId === user.id ||
      order.store.sellerProfile.userId === user.id ||
      order.store.members.some((member) => member.userId === user.id);
    if (!allowed || message.senderId !== user.id)
      throw new ForbiddenException('Attachment access denied');
    const document = detectVerificationDocument(bytes);
    if (!document)
      throw new UnsupportedMediaTypeException(
        'Only valid PDF, JPEG, and PNG attachments are accepted',
      );
    await mkdir(this.privateRoot, { recursive: true });
    const storageKey = `${randomBytes(24).toString('hex')}.${document.extension}`;
    const filePath = resolve(this.privateRoot, storageKey);
    await writeFile(filePath, bytes, { flag: 'wx', mode: 0o600 });
    try {
      return await this.prisma.attachment.create({
        data: {
          messageId,
          uploaderId: user.id,
          storageKey,
          mimeType: document.mimeType,
          sizeBytes: bytes.length,
          fileName: fileName.slice(0, 180) || 'attachment',
        },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
        },
      });
    } catch (error) {
      await unlink(filePath).catch(() => undefined);
      throw error;
    }
  }

  async messageAttachment(user: AuthenticatedUser, attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        message: {
          include: {
            conversation: {
              include: {
                order: {
                  include: {
                    store: { include: { sellerProfile: true, members: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!attachment?.message.conversation.order)
      throw new NotFoundException('Attachment not found');
    const order = attachment.message.conversation.order;
    const participant =
      order.buyerId === user.id ||
      order.store.sellerProfile.userId === user.id ||
      order.store.members.some((member) => member.userId === user.id);
    if (
      !participant &&
      !user.roles.some((role) =>
        ['SUPPORT_ADMIN', 'DISPUTE_ADMIN', 'SUPER_ADMIN'].includes(role),
      )
    )
      throw new ForbiddenException('Attachment access denied');
    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'ORDER_ATTACHMENT_VIEWED',
        targetType: 'Attachment',
        targetId: attachment.id,
      },
    });
    return {
      bytes: await readFile(resolve(this.privateRoot, attachment.storageKey)),
      mimeType: attachment.mimeType,
      fileName: attachment.fileName,
    };
  }

  async uploadDisputeEvidence(
    user: AuthenticatedUser,
    disputeId: string,
    bytes: Buffer,
    fileName: string,
  ) {
    await this.scanner.assertClean(bytes);
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        order: {
          include: {
            store: { include: { sellerProfile: true, members: true } },
          },
        },
        _count: { select: { evidence: true } },
      },
    });
    if (!dispute) throw new NotFoundException('Dispute not found');
    const participant =
      dispute.order.buyerId === user.id ||
      dispute.order.store.sellerProfile.userId === user.id ||
      dispute.order.store.members.some((member) => member.userId === user.id);
    if (
      !participant &&
      !user.roles.some((role) =>
        ['DISPUTE_ADMIN', 'SUPER_ADMIN'].includes(role),
      )
    )
      throw new ForbiddenException('Dispute access denied');
    if (dispute._count.evidence >= 20)
      throw new ConflictException(
        'A dispute can contain at most 20 evidence files',
      );
    const document = detectVerificationDocument(bytes);
    if (!document)
      throw new UnsupportedMediaTypeException(
        'Only valid PDF, JPEG, and PNG evidence is accepted',
      );
    await mkdir(this.privateRoot, { recursive: true });
    const storageKey = `${randomBytes(24).toString('hex')}.${document.extension}`;
    const filePath = resolve(this.privateRoot, storageKey);
    await writeFile(filePath, bytes, { flag: 'wx', mode: 0o600 });
    try {
      return await this.prisma.$transaction(async (tx) => {
        const evidence = await tx.disputeEvidence.create({
          data: {
            disputeId,
            uploadedById: user.id,
            storageKey,
            mimeType: document.mimeType,
            sizeBytes: bytes.length,
            fileName: fileName.slice(0, 180) || 'evidence',
          },
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            sizeBytes: true,
            createdAt: true,
          },
        });
        await tx.disputeEvent.create({
          data: {
            disputeId,
            actorId: user.id,
            type: 'EVIDENCE_ADDED',
            payload: { evidenceId: evidence.id, mimeType: evidence.mimeType },
          },
        });
        return evidence;
      });
    } catch (error) {
      await unlink(filePath).catch(() => undefined);
      throw error;
    }
  }

  async disputeEvidence(user: AuthenticatedUser, evidenceId: string) {
    const evidence = await this.prisma.disputeEvidence.findUnique({
      where: { id: evidenceId },
      include: {
        dispute: {
          include: {
            order: {
              include: {
                store: { include: { sellerProfile: true, members: true } },
              },
            },
          },
        },
      },
    });
    if (!evidence) throw new NotFoundException('Evidence not found');
    const order = evidence.dispute.order;
    const participant =
      order.buyerId === user.id ||
      order.store.sellerProfile.userId === user.id ||
      order.store.members.some((member) => member.userId === user.id);
    if (
      !participant &&
      !user.roles.some((role) =>
        ['DISPUTE_ADMIN', 'SUPER_ADMIN'].includes(role),
      )
    )
      throw new ForbiddenException('Evidence access denied');
    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'DISPUTE_EVIDENCE_VIEWED',
        targetType: 'DisputeEvidence',
        targetId: evidence.id,
      },
    });
    return {
      bytes: await readFile(resolve(this.privateRoot, evidence.storageKey)),
      mimeType: evidence.mimeType,
      fileName: evidence.fileName,
    };
  }
}
