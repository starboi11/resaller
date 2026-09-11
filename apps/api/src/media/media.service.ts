import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnsupportedMediaTypeException } from '@nestjs/common';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { PrismaService } from '../infrastructure/prisma.service.js';
import { detectSafeImage } from './media-signature.js';
import { detectVerificationDocument } from './verification-document.js';

@Injectable()
export class MediaService {
  private readonly root = resolve(process.env.MEDIA_ROOT ?? './data/media');
  private readonly privateRoot = resolve(process.env.PRIVATE_MEDIA_ROOT ?? './data/private-media');
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async uploadListingImage(userId: string, listingPublicId: string, bytes: Buffer) {
    const listing = await this.prisma.listing.findUnique({ where: { publicId: listingPublicId }, include: { store: { include: { sellerProfile: true, members: true } }, media: { select: { position: true } } } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.store.sellerProfile.userId !== userId && !listing.store.members.some((member) => member.userId === userId)) throw new ForbiddenException('Listing access denied');
    if (listing.media.length >= 10) throw new ConflictException('A listing can contain at most 10 images');
    const image = detectSafeImage(bytes);
    if (!image) throw new UnsupportedMediaTypeException('Only valid JPEG, PNG, and WebP images are accepted');
    await mkdir(this.root, { recursive: true });
    const storageKey = `${randomBytes(24).toString('hex')}.${image.extension}`;
    const filePath = resolve(this.root, storageKey);
    await writeFile(filePath, bytes, { flag: 'wx' });
    try {
      const position = listing.media.reduce((highest, item) => Math.max(highest, item.position), -1) + 1;
      const media = await this.prisma.listingMedia.create({ data: { listingId: listing.id, storageKey, mimeType: image.mimeType, position }, select: { id: true, storageKey: true, mimeType: true, position: true } });
      return { ...media, url: `/api/v1/media/${storageKey}` };
    } catch (error) { await unlink(filePath).catch(() => undefined); throw error; }
  }

  async publicImage(storageKey: string) {
    if (!/^[a-f0-9]{48}\.(jpg|png|webp)$/.test(storageKey)) throw new NotFoundException('Media not found');
    const media = await this.prisma.listingMedia.findUnique({ where: { storageKey }, include: { listing: { select: { status: true, deletedAt: true, store: { select: { status: true } } } } } });
    if (!media || media.listing.deletedAt || media.listing.status !== 'ACTIVE' || media.listing.store.status !== 'ACTIVE') throw new NotFoundException('Media not found');
    return { bytes: await readFile(resolve(this.root, storageKey)), mimeType: media.mimeType };
  }

  async uploadVerificationDocument(userId: string, bytes: Buffer) {
    const verification = await this.prisma.sellerVerification.findFirst({ where: { sellerProfile: { userId } } });
    if (!verification) throw new NotFoundException('Verification details are required before document upload');
    const document = detectVerificationDocument(bytes);
    if (!document) throw new UnsupportedMediaTypeException('Only valid PDF, JPEG, and PNG documents are accepted');
    await mkdir(this.privateRoot, { recursive: true });
    const storageKey = `${randomBytes(24).toString('hex')}.${document.extension}`;
    const filePath = resolve(this.privateRoot, storageKey);
    await writeFile(filePath, bytes, { flag: 'wx', mode: 0o600 });
    const oldKey = verification.documentStorageKey;
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const row = await tx.sellerVerification.update({ where: { id: verification.id }, data: { documentStorageKey: storageKey, status: 'PENDING_REVIEW', submittedAt: new Date(), reviewedAt: null, reviewReason: null }, select: { id: true, status: true, submittedAt: true } });
        await tx.auditLog.create({ data: { actorId: userId, action: 'VERIFICATION_DOCUMENT_UPLOADED', targetType: 'SellerVerification', targetId: verification.id, metadata: { mimeType: document.mimeType } } });
        return row;
      });
      if (oldKey && /^[a-f0-9]{48}\.(pdf|jpg|png)$/.test(oldKey)) await unlink(resolve(this.privateRoot, oldKey)).catch(() => undefined);
      return updated;
    } catch (error) { await unlink(filePath).catch(() => undefined); throw error; }
  }

  async verificationDocument(actorId: string, verificationId: string) {
    const verification = await this.prisma.sellerVerification.findUnique({ where: { id: verificationId }, select: { id: true, documentStorageKey: true } });
    if (!verification?.documentStorageKey || !/^[a-f0-9]{48}\.(pdf|jpg|png)$/.test(verification.documentStorageKey)) throw new NotFoundException('Verification document not found');
    const extension = verification.documentStorageKey.split('.').at(-1);
    const mimeType = extension === 'pdf' ? 'application/pdf' : extension === 'png' ? 'image/png' : 'image/jpeg';
    await this.prisma.auditLog.create({ data: { actorId, action: 'VERIFICATION_DOCUMENT_VIEWED', targetType: 'SellerVerification', targetId: verification.id } });
    return { bytes: await readFile(resolve(this.privateRoot, verification.documentStorageKey)), mimeType };
  }

}
