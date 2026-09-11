import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnsupportedMediaTypeException } from '@nestjs/common';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { PrismaService } from '../infrastructure/prisma.service.js';
import { detectSafeImage } from './media-signature.js';

@Injectable()
export class MediaService {
  private readonly root = resolve(process.env.MEDIA_ROOT ?? './data/media');
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
}
