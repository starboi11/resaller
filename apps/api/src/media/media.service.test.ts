import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../infrastructure/prisma.service.js';
import { MalwareScannerService } from './malware-scanner.service.js';
import { MediaService } from './media.service.js';
import { MediaStorageService } from './media-storage.service.js';

const storageKey = `${'a'.repeat(48)}.webp`;

function fixture(ownerId = 'owner') {
  const findFirst = vi.fn().mockResolvedValue({
    mimeType: 'image/webp',
    listing: {
      store: {
        sellerProfile: { userId: ownerId },
        members: [{ userId: 'team-member' }],
      },
    },
  });
  const get = vi.fn().mockResolvedValue(Buffer.from('image-data'));
  const service = new MediaService(
    { listingMedia: { findFirst }, listing: { findFirst: vi.fn().mockResolvedValue(null) } } as unknown as PrismaService,
    { get } as unknown as MediaStorageService,
    {} as MalwareScannerService,
  );
  return { service, findFirst, get };
}

describe('draft listing media authorization', () => {
  it('returns media to the owning seller only', async () => {
    const { service, get } = fixture();
    expect(await service.listingImageForOwner('owner', 'listing', storageKey)).toMatchObject({
      mimeType: 'image/webp',
    });
    await expect(service.listingImageForOwner('team-member', 'listing', storageKey)).rejects.toBeInstanceOf(NotFoundException);
    expect(get).toHaveBeenCalledWith(storageKey);
  });

  it('does not read the object for another user', async () => {
    const { service, get } = fixture();
    await expect(service.listingImageForOwner('stranger', 'listing', storageKey)).rejects.toBeInstanceOf(NotFoundException);
    expect(get).not.toHaveBeenCalled();
  });

  it('rejects an invalid key before querying the database', async () => {
    const { service, findFirst } = fixture();
    await expect(service.listingImageForOwner('owner', 'listing', '../other')).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).not.toHaveBeenCalled();
  });
});

describe('verification document upload', () => {
  it('does not replace an already approved identity document', async () => {
    const putPrivate = vi.fn();
    const service = new MediaService(
      {
        sellerVerification: {
          findFirst: vi.fn().mockResolvedValue({
            status: 'APPROVED',
            sellerProfile: { verifiedAt: new Date() },
          }),
        },
      } as unknown as PrismaService,
      { putPrivate } as unknown as MediaStorageService,
      { assertClean: vi.fn() } as unknown as MalwareScannerService,
    );
    await expect(
      service.uploadVerificationDocument('seller', Buffer.from('%PDF-1.4\n%%EOF')),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(putPrivate).not.toHaveBeenCalled();
  });
});
