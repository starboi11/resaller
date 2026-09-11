import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../infrastructure/prisma.service.js';
import type { AuthenticatedUser } from '../auth/session.guard.js';
import type {
  AddStoreMemberDto,
  CreateListingDto,
  CreateStoreDto,
  MarketplaceQueryDto,
  SellerVerificationDto,
  StoreSettingsDto,
  UpdateListingDto,
} from './commerce.dto.js';

@Injectable()
export class CommerceService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async applySeller(user: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.sellerProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id },
        update: {},
      });
      if (!user.roles.includes('SELLER'))
        await tx.user.update({
          where: { id: user.id },
          data: { roles: { push: 'SELLER' } },
        });
      return {
        publicId: profile.id,
        status: profile.verifiedAt ? 'VERIFIED' : 'PENDING_VERIFICATION',
      };
    });
  }

  async submitVerification(userId: string, input: SellerVerificationDto) {
    const profile = await this.prisma.sellerProfile.findUnique({
      where: { userId },
    });
    if (!profile)
      throw new ForbiddenException('Seller application is required');
    const existing = await this.prisma.sellerVerification.findUnique({
      where: { sellerProfileId: profile.id },
      select: { documentStorageKey: true },
    });
    const compact = input.documentNumber.replace(/\s+/g, '');
    const masked = `${'*'.repeat(Math.max(0, compact.length - 4))}${compact.slice(-4)}`;
    const ready = Boolean(existing?.documentStorageKey);
    return this.prisma.sellerVerification.upsert({
      where: { sellerProfileId: profile.id },
      create: {
        sellerProfileId: profile.id,
        legalName: input.legalName,
        documentType: input.documentType,
        documentNumberMasked: masked,
        status: 'DOCUMENT_REQUIRED',
      },
      update: {
        legalName: input.legalName,
        documentType: input.documentType,
        documentNumberMasked: masked,
        status: ready ? 'PENDING_REVIEW' : 'DOCUMENT_REQUIRED',
        submittedAt: ready ? new Date() : null,
        reviewedAt: null,
        reviewReason: null,
      },
      select: {
        id: true,
        status: true,
        documentType: true,
        documentNumberMasked: true,
        submittedAt: true,
      },
    });
  }

  async createStore(user: AuthenticatedUser, input: CreateStoreDto) {
    const seller = await this.prisma.sellerProfile.findUnique({
      where: { userId: user.id },
    });
    if (!seller) throw new ForbiddenException('Seller application is required');
    try {
      return await this.prisma.store.create({
        data: {
          sellerProfileId: seller.id,
          username: input.username,
          nameUz: input.nameUz,
          nameRu: input.nameRu ?? null,
          orderPrefix: input.orderPrefix,
          members: { create: { userId: user.id, role: 'STORE_MANAGER' } },
        },
        select: {
          publicId: true,
          username: true,
          nameUz: true,
          status: true,
          orderPrefix: true,
        },
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error &&
        'code' in error &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'Store username or order prefix is unavailable',
        );
      throw error;
    }
  }

  async updateStoreSettings(
    user: AuthenticatedUser,
    publicId: string,
    input: StoreSettingsDto,
  ) {
    const store = await this.prisma.store.findUnique({
      where: { publicId },
      include: { sellerProfile: true, members: { where: { userId: user.id } } },
    });
    if (!store) throw new NotFoundException('Store not found');
    if (store.sellerProfile.userId !== user.id && store.members.length === 0)
      throw new ForbiddenException('Store access denied');
    const settings = await this.prisma.storeSetting.upsert({
      where: { storeId: store.id },
      create: {
        storeId: store.id,
        workingHours: input.workingHours as object,
        deliverySettings: input.deliverySettings as object,
        vacationMessageUz: input.vacationMessageUz ?? null,
        vacationMessageRu: input.vacationMessageRu ?? null,
      },
      update: {
        workingHours: input.workingHours as object,
        deliverySettings: input.deliverySettings as object,
        vacationMessageUz: input.vacationMessageUz ?? null,
        vacationMessageRu: input.vacationMessageRu ?? null,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'STORE_SETTINGS_UPDATED',
        targetType: 'Store',
        targetId: store.id,
      },
    });
    return settings;
  }

  async setVacationMode(
    user: AuthenticatedUser,
    publicId: string,
    enabled: boolean,
  ) {
    const store = await this.prisma.store.findUnique({
      where: { publicId },
      include: { sellerProfile: true, members: { where: { userId: user.id } } },
    });
    if (!store) throw new NotFoundException('Store not found');
    if (store.sellerProfile.userId !== user.id && store.members.length === 0)
      throw new ForbiddenException('Store access denied');
    const updated = await this.prisma.store.update({
      where: { id: store.id },
      data: { vacationMode: enabled },
      select: { publicId: true, vacationMode: true },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'STORE_VACATION_CHANGED',
        targetType: 'Store',
        targetId: store.id,
        metadata: { enabled },
      },
    });
    return updated;
  }

  async addStoreMember(
    user: AuthenticatedUser,
    publicId: string,
    input: AddStoreMemberDto,
  ) {
    const store = await this.prisma.store.findUnique({
      where: { publicId },
      include: { sellerProfile: true },
    });
    if (!store) throw new NotFoundException('Store not found');
    if (store.sellerProfile.userId !== user.id)
      throw new ForbiddenException(
        'Only the store owner can manage team members',
      );
    const member = await this.prisma.user.findUnique({
      where: { username: input.username },
    });
    if (!member || member.deletedAt)
      throw new NotFoundException('User not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.storeMember.upsert({
        where: { storeId_userId: { storeId: store.id, userId: member.id } },
        create: { storeId: store.id, userId: member.id, role: input.role },
        update: { role: input.role },
      });
      if (!member.roles.includes(input.role))
        await tx.user.update({
          where: { id: member.id },
          data: { roles: { push: input.role } },
        });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'STORE_MEMBER_UPSERTED',
          targetType: 'StoreMember',
          targetId: member.id,
          metadata: { storeId: store.id, role: input.role },
        },
      });
    });
    return { username: member.username, role: input.role };
  }

  async removeStoreMember(
    user: AuthenticatedUser,
    publicId: string,
    username: string,
  ) {
    const store = await this.prisma.store.findUnique({
      where: { publicId },
      include: { sellerProfile: true },
    });
    if (!store) throw new NotFoundException('Store not found');
    if (store.sellerProfile.userId !== user.id)
      throw new ForbiddenException(
        'Only the store owner can manage team members',
      );
    const member = await this.prisma.user.findUnique({ where: { username } });
    if (!member) throw new NotFoundException('User not found');
    const removed = await this.prisma.storeMember.deleteMany({
      where: { storeId: store.id, userId: member.id },
    });
    if (!removed.count) throw new NotFoundException('Store member not found');
    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'STORE_MEMBER_REMOVED',
        targetType: 'StoreMember',
        targetId: member.id,
        metadata: { storeId: store.id },
      },
    });
    return { removed: true };
  }

  async getStore(username: string) {
    const store = await this.prisma.store.findUnique({
      where: { username },
      select: {
        publicId: true,
        username: true,
        nameUz: true,
        nameRu: true,
        descriptionUz: true,
        descriptionRu: true,
        status: true,
        vacationMode: true,
        sellerProfile: { select: { trustBadge: true, verifiedAt: true } },
      },
    });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  async createListing(
    user: AuthenticatedUser,
    storePublicId: string,
    input: CreateListingDto,
  ) {
    const store = await this.prisma.store.findUnique({
      where: { publicId: storePublicId },
      include: { sellerProfile: true, members: { where: { userId: user.id } } },
    });
    if (!store) throw new NotFoundException('Store not found');
    if (store.sellerProfile.userId !== user.id && store.members.length === 0)
      throw new ForbiddenException('Store access denied');
    const category = await this.prisma.category.upsert({
      where: { slug: input.categorySlug ?? 'other' },
      create: { slug: input.categorySlug ?? 'other', nameUz: 'Boshqa' },
      update: {},
    });
    const listing = await this.prisma.listing.create({
      data: {
        storeId: store.id,
        categoryId: category.id,
        nameUz: input.nameUz,
        nameRu: input.nameRu ?? null,
        descriptionUz: input.descriptionUz,
        priceMinor: BigInt(input.priceMinor),
        variants: {
          create: {
            sku: input.sku,
            options: {},
            inventory: { create: { available: input.stock } },
          },
        },
      },
      select: {
        publicId: true,
        nameUz: true,
        status: true,
        priceMinor: true,
        variants: { select: { sku: true, inventory: true } },
      },
    });
    return { ...listing, priceMinor: listing.priceMinor.toString() };
  }

  async updateListing(
    user: AuthenticatedUser,
    publicId: string,
    input: UpdateListingDto,
  ) {
    const listing = await this.prisma.listing.findUnique({
      where: { publicId },
      include: {
        store: {
          include: {
            sellerProfile: true,
            members: { where: { userId: user.id } },
          },
        },
        variants: { include: { inventory: true }, take: 1 },
      },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (
      listing.store.sellerProfile.userId !== user.id &&
      listing.store.members.length === 0
    )
      throw new ForbiddenException('Listing access denied');
    if (!['DRAFT', 'REJECTED', 'PAUSED'].includes(listing.status))
      throw new ConflictException(
        'Listing cannot be edited in its current status',
      );
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.listing.update({
        where: { id: listing.id },
        data: {
          ...(input.nameUz !== undefined ? { nameUz: input.nameUz } : {}),
          ...(input.descriptionUz !== undefined
            ? { descriptionUz: input.descriptionUz }
            : {}),
          ...(input.priceMinor !== undefined
            ? { priceMinor: BigInt(input.priceMinor) }
            : {}),
          ...(listing.status === 'REJECTED'
            ? { status: 'DRAFT' as const }
            : {}),
        },
        select: {
          publicId: true,
          nameUz: true,
          descriptionUz: true,
          priceMinor: true,
          status: true,
        },
      });
      const variant = listing.variants[0];
      if (input.stock !== undefined && variant?.inventory)
        await tx.inventory.update({
          where: { variantId: variant.id },
          data: { available: input.stock, version: { increment: 1 } },
        });
      return {
        ...updated,
        priceMinor: updated.priceMinor.toString(),
        stock: input.stock ?? variant?.inventory?.available ?? 0,
      };
    });
  }

  async submitListing(user: AuthenticatedUser, publicId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { publicId },
      include: {
        store: {
          include: {
            sellerProfile: true,
            members: { where: { userId: user.id } },
          },
        },
        media: true,
        variants: { include: { inventory: true } },
      },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (
      listing.store.sellerProfile.userId !== user.id &&
      listing.store.members.length === 0
    )
      throw new ForbiddenException('Listing access denied');
    if (!['DRAFT', 'REJECTED'].includes(listing.status))
      throw new ConflictException(
        'Listing cannot be submitted in its current status',
      );
    if (!listing.media.length)
      throw new ConflictException('At least one product image is required');
    if (
      !listing.variants.some(
        (variant) => (variant.inventory?.available ?? 0) > 0,
      )
    )
      throw new ConflictException('Available stock is required');
    return this.prisma.listing.update({
      where: { id: listing.id },
      data: { status: 'PENDING_REVIEW' },
      select: { publicId: true, status: true },
    });
  }

  async marketplace(query: MarketplaceQueryDto) {
    const listings = await this.prisma.listing.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        store: { status: 'ACTIVE', vacationMode: false },
        ...(query.q
          ? {
              OR: [
                { nameUz: { contains: query.q, mode: 'insensitive' } },
                { nameRu: { contains: query.q, mode: 'insensitive' } },
                { descriptionUz: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(query.category ? { category: { slug: query.category } } : {}),
        ...(query.minPrice !== undefined || query.maxPrice !== undefined
          ? {
              priceMinor: {
                ...(query.minPrice !== undefined
                  ? { gte: BigInt(query.minPrice) }
                  : {}),
                ...(query.maxPrice !== undefined
                  ? { lte: BigInt(query.maxPrice) }
                  : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 24,
      select: {
        publicId: true,
        nameUz: true,
        nameRu: true,
        priceMinor: true,
        currency: true,
        category: { select: { slug: true, nameUz: true } },
        store: {
          select: {
            username: true,
            nameUz: true,
            sellerProfile: { select: { trustBadge: true } },
          },
        },
        variants: {
          select: {
            inventory: { select: { available: true, reserved: true } },
          },
        },
        media: {
          orderBy: { position: 'asc' },
          take: 1,
          select: {
            storageKey: true,
            thumbnailStorageKey: true,
            mimeType: true,
          },
        },
      },
    });
    return listings.map((listing) => ({
      ...listing,
      priceMinor: listing.priceMinor.toString(),
    }));
  }

  async getListing(publicId: string) {
    const listing = await this.prisma.listing.findFirst({
      where: {
        publicId,
        status: 'ACTIVE',
        deletedAt: null,
        store: { status: 'ACTIVE' },
      },
      include: {
        category: { select: { slug: true, nameUz: true } },
        store: {
          select: {
            publicId: true,
            username: true,
            nameUz: true,
            sellerProfile: { select: { trustBadge: true, verifiedAt: true } },
          },
        },
        variants: { include: { inventory: true } },
        media: { orderBy: { position: 'asc' } },
      },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    return {
      ...listing,
      priceMinor: listing.priceMinor.toString(),
      variants: listing.variants.map((variant) => ({
        ...variant,
        priceOverrideMinor: variant.priceOverrideMinor?.toString() ?? null,
      })),
    };
  }

  async favorites(userId: string) {
    const rows = await this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        listing: {
          select: {
            publicId: true,
            nameUz: true,
            priceMinor: true,
            currency: true,
          },
        },
      },
    });
    return rows.map((row) => ({
      ...row.listing,
      priceMinor: row.listing.priceMinor.toString(),
      favoritedAt: row.createdAt,
    }));
  }

  async favorite(userId: string, listingPublicId: string) {
    const listing = await this.prisma.listing.findFirst({
      where: { publicId: listingPublicId, status: 'ACTIVE' },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    await this.prisma.favorite.upsert({
      where: { userId_listingId: { userId, listingId: listing.id } },
      create: { userId, listingId: listing.id },
      update: {},
    });
    return { favorited: true };
  }
  async unfavorite(userId: string, listingPublicId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { publicId: listingPublicId },
    });
    if (listing)
      await this.prisma.favorite.deleteMany({
        where: { userId, listingId: listing.id },
      });
    return { favorited: false };
  }
  async follow(userId: string, storePublicId: string) {
    const store = await this.prisma.store.findUnique({
      where: { publicId: storePublicId },
    });
    if (!store) throw new NotFoundException('Store not found');
    await this.prisma.storeFollower.upsert({
      where: { userId_storeId: { userId, storeId: store.id } },
      create: { userId, storeId: store.id },
      update: {},
    });
    return { following: true };
  }
  async unfollow(userId: string, storePublicId: string) {
    const store = await this.prisma.store.findUnique({
      where: { publicId: storePublicId },
    });
    if (store)
      await this.prisma.storeFollower.deleteMany({
        where: { userId, storeId: store.id },
      });
    return { following: false };
  }
}
