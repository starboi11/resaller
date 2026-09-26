import { NotFoundException } from '@nestjs/common';
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
    { listingMedia: { findFirst } } as unknown as PrismaService,
    { get } as unknown as MediaStorageService,
    {} as MalwareScannerService,
  );
  return { service, findFirst, get };
}

describe('draft listing media authorization', () => {
  it('returns media to the owning seller and store member', async () => {
    const { service, get } = fixture();
    expect(await service.listingImageForOwner('owner', 'listing', storageKey)).toMatchObject({
      mimeType: 'image/webp',
    });
    expect(await service.listingImageForOwner('team-member', 'listing', storageKey)).toMatchObject({
      mimeType: 'image/webp',
    });
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
