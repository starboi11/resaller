import {
  BadRequestException,
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
  CreateVariantDto,
  CreateCouponDto,
  CreatePromotionDto,
  CreateTestimonialDto,
  CreateCollectionDto,
  MarketplaceQueryDto,
  SellerVerificationDto,
  StoreSettingsDto,
  UpdateListingDto,
  UpdateVariantDto,
} from './commerce.dto.js';
import {
  cleanVariantOptions,
  validateCategoryAttributes,
} from './catalog-validation.js';
import { marketplaceScore } from './marketplace-search.js';

@Injectable()
export class CommerceService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async managedStore(userId: string, publicId: string) {
    const store = await this.prisma.store.findUnique({
      where: { publicId },
      include: { sellerProfile: true, members: { where: { userId } } },
    });
    if (!store) throw new NotFoundException('Store not found');
    if (store.sellerProfile.userId !== userId && store.members.length === 0)
      throw new ForbiddenException('Store access denied');
    return store;
  }

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

  async sellerStores(userId: string) {
    const stores = await this.prisma.store.findMany({
      where: {
        OR: [{ sellerProfile: { userId } }, { members: { some: { userId } } }],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        publicId: true,
        username: true,
        nameUz: true,
        status: true,
        vacationMode: true,
        logoStorageKey: true,
        bannerStorageKey: true,
        premiumUntil: true,
        settings: true,
        members: {
          select: { role: true, user: { select: { username: true } } },
        },
        questions: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            body: true,
            createdAt: true,
            answer: { select: { id: true, body: true } },
            listing: { select: { nameUz: true } },
          },
        },
        importedTestimonials: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            sourceLabel: true,
            authorLabel: true,
            body: true,
            createdAt: true,
          },
        },
        collections: {
          orderBy: { position: 'asc' },
          include: {
            items: {
              orderBy: { position: 'asc' },
              include: {
                listing: { select: { publicId: true, nameUz: true } },
              },
            },
          },
        },
        listings: {
          orderBy: { createdAt: 'desc' },
          select: {
            publicId: true,
            nameUz: true,
            status: true,
            priceMinor: true,
            salePriceMinor: true,
            videoStorageKey: true,
            currency: true,
            variants: {
              select: {
                id: true,
                sku: true,
                options: true,
                priceOverrideMinor: true,
                inventory: true,
              },
            },
            media: {
              orderBy: { position: 'asc' },
              select: {
                id: true,
                storageKey: true,
                thumbnailStorageKey: true,
                position: true,
                variantId: true,
              },
            },
          },
        },
      },
    });
    return stores.map((store) => ({
      ...store,
      listings: store.listings.map((listing) => ({
        ...listing,
        priceMinor: listing.priceMinor.toString(),
        salePriceMinor: listing.salePriceMinor?.toString() ?? null,
        variants: listing.variants.map((variant) => ({
          ...variant,
          priceOverrideMinor: variant.priceOverrideMinor?.toString() ?? null,
        })),
      })),
    }));
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
        logoStorageKey: true,
        bannerStorageKey: true,
        premiumUntil: true,
        sellerProfile: { select: { trustBadge: true, verifiedAt: true } },
        settings: {
          select: {
            deliverySettings: true,
            workingHours: true,
            vacationMessageUz: true,
          },
        },
        policies: {
          take: 1,
          orderBy: { version: 'desc' },
          select: { version: true, content: true, publishedAt: true },
        },
        questions: {
          where: { reportedAt: null },
          take: 20,
          orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            body: true,
            pinned: true,
            createdAt: true,
            author: { select: { username: true } },
            answer: { select: { body: true, createdAt: true } },
          },
        },
        importedTestimonials: {
          take: 12,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            sourceLabel: true,
            authorLabel: true,
            body: true,
            createdAt: true,
          },
        },
        collections: {
          where: { active: true },
          orderBy: { position: 'asc' },
          select: {
            publicId: true,
            nameUz: true,
            items: {
              orderBy: { position: 'asc' },
              select: { listing: { select: { publicId: true, nameUz: true } } },
            },
          },
        },
        listings: {
          where: { status: 'ACTIVE' },
          take: 60,
          orderBy: { createdAt: 'desc' },
          select: {
            publicId: true,
            nameUz: true,
            priceMinor: true,
            currency: true,
            media: {
              take: 1,
              orderBy: { position: 'asc' },
              select: { storageKey: true, thumbnailStorageKey: true },
            },
            variants: {
              select: { inventory: { select: { available: true } } },
            },
          },
        },
      },
    });
    if (!store) throw new NotFoundException('Store not found');
    return {
      ...store,
      listings: store.listings.map((listing) => ({
        ...listing,
        priceMinor: listing.priceMinor.toString(),
      })),
    };
  }

  async createListing(
    user: AuthenticatedUser,
    storePublicId: string,
    input: CreateListingDto,
  ) {
    if (
      input.salePriceMinor !== undefined &&
      input.salePriceMinor >= input.priceMinor
    )
      throw new BadRequestException(
        'Sale price must be lower than the regular price',
      );
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
      include: { attributes: { orderBy: { position: 'asc' } } },
    });
    const attributeValues = this.validateAttributes(
      category.attributes,
      input.attributeValues ?? {},
    );
    const listing = await this.prisma.listing.create({
      data: {
        storeId: store.id,
        categoryId: category.id,
        nameUz: input.nameUz,
        nameRu: input.nameRu ?? null,
        descriptionUz: input.descriptionUz,
        descriptionRu: input.descriptionRu ?? null,
        attributeValues,
        priceMinor: BigInt(input.priceMinor),
        salePriceMinor:
          input.salePriceMinor === undefined
            ? null
            : BigInt(input.salePriceMinor),
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
        salePriceMinor: true,
        variants: { select: { sku: true, inventory: true } },
      },
    });
    return {
      ...listing,
      priceMinor: listing.priceMinor.toString(),
      salePriceMinor: listing.salePriceMinor?.toString() ?? null,
    };
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
        category: { include: { attributes: { orderBy: { position: 'asc' } } } },
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
    const nextPrice = input.priceMinor ?? Number(listing.priceMinor);
    const nextSale =
      input.salePriceMinor ??
      (listing.salePriceMinor === null
        ? undefined
        : Number(listing.salePriceMinor));
    if (nextSale !== undefined && nextSale >= nextPrice)
      throw new BadRequestException(
        'Sale price must be lower than the regular price',
      );
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.listing.update({
        where: { id: listing.id },
        data: {
          ...(input.nameUz !== undefined ? { nameUz: input.nameUz } : {}),
          ...(input.descriptionUz !== undefined
            ? { descriptionUz: input.descriptionUz }
            : {}),
          ...(input.descriptionRu !== undefined
            ? { descriptionRu: input.descriptionRu }
            : {}),
          ...(input.priceMinor !== undefined
            ? { priceMinor: BigInt(input.priceMinor) }
            : {}),
          ...(input.salePriceMinor !== undefined
            ? { salePriceMinor: BigInt(input.salePriceMinor) }
            : {}),
          ...(input.attributeValues !== undefined
            ? {
                attributeValues: this.validateAttributes(
                  listing.category.attributes,
                  input.attributeValues,
                ),
              }
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

  categories() {
    return this.prisma.category.findMany({
      orderBy: [{ parentId: 'asc' }, { nameUz: 'asc' }],
      select: {
        slug: true,
        nameUz: true,
        nameRu: true,
        parent: { select: { slug: true } },
        attributes: {
          orderBy: { position: 'asc' },
          select: {
            key: true,
            labelUz: true,
            labelRu: true,
            type: true,
            required: true,
            options: true,
            position: true,
          },
        },
      },
    });
  }

  async createVariant(
    user: AuthenticatedUser,
    publicId: string,
    input: CreateVariantDto,
  ) {
    const listing = await this.editableListing(user, publicId);
    const count = await this.prisma.listingVariant.count({
      where: { listingId: listing.id },
    });
    if (count >= 100)
      throw new ConflictException('A listing can contain at most 100 variants');
    const variant = await this.prisma.listingVariant.create({
      data: {
        listingId: listing.id,
        sku: input.sku,
        options: this.cleanVariantOptions(input.options),
        priceOverrideMinor:
          input.priceOverrideMinor === undefined
            ? null
            : BigInt(input.priceOverrideMinor),
        inventory: { create: { available: input.stock } },
      },
      include: { inventory: true },
    });
    return {
      ...variant,
      priceOverrideMinor: variant.priceOverrideMinor?.toString() ?? null,
    };
  }

  async updateVariant(
    user: AuthenticatedUser,
    publicId: string,
    variantId: string,
    input: UpdateVariantDto,
  ) {
    const listing = await this.editableListing(user, publicId);
    const variant = await this.prisma.listingVariant.findFirst({
      where: { id: variantId, listingId: listing.id },
      include: { inventory: true },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.listingVariant.update({
        where: { id: variant.id },
        data: {
          ...(input.sku !== undefined ? { sku: input.sku } : {}),
          ...(input.options !== undefined
            ? { options: this.cleanVariantOptions(input.options) }
            : {}),
          ...(input.priceOverrideMinor !== undefined
            ? { priceOverrideMinor: BigInt(input.priceOverrideMinor) }
            : {}),
        },
      });
      if (input.stock !== undefined)
        await tx.inventory.update({
          where: { variantId: variant.id },
          data: { available: input.stock, version: { increment: 1 } },
        });
      const inventory =
        input.stock === undefined
          ? variant.inventory
          : await tx.inventory.findUnique({ where: { variantId: variant.id } });
      return {
        ...updated,
        priceOverrideMinor: updated.priceOverrideMinor?.toString() ?? null,
        inventory,
      };
    });
  }

  async removeVariant(
    user: AuthenticatedUser,
    publicId: string,
    variantId: string,
  ) {
    const listing = await this.editableListing(user, publicId);
    const [variant, count] = await Promise.all([
      this.prisma.listingVariant.findFirst({
        where: { id: variantId, listingId: listing.id },
        select: {
          id: true,
          _count: {
            select: { cartItems: true, orderItems: true, reservations: true },
          },
        },
      }),
      this.prisma.listingVariant.count({ where: { listingId: listing.id } }),
    ]);
    if (!variant) throw new NotFoundException('Variant not found');
    if (count <= 1)
      throw new ConflictException('A listing must keep at least one variant');
    if (
      variant._count.cartItems ||
      variant._count.orderItems ||
      variant._count.reservations
    )
      throw new ConflictException('A used variant cannot be deleted');
    await this.prisma.listingVariant.delete({ where: { id: variant.id } });
    return { removed: true };
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

  async reorderMedia(user: AuthenticatedUser, publicId: string, ids: string[]) {
    const listing = await this.editableListing(user, publicId);
    const media = await this.prisma.listingMedia.findMany({
      where: { listingId: listing.id },
      select: { id: true },
    });
    if (
      ids.length !== media.length ||
      new Set(ids).size !== ids.length ||
      media.some((item) => !ids.includes(item.id))
    )
      throw new BadRequestException(
        'Media order must contain every image exactly once',
      );
    await this.prisma.$transaction(async (tx) => {
      for (let index = 0; index < ids.length; index++)
        await tx.listingMedia.update({
          where: { id: ids[index]! },
          data: { position: 1000 + index },
        });
      for (let index = 0; index < ids.length; index++)
        await tx.listingMedia.update({
          where: { id: ids[index]! },
          data: { position: index },
        });
    });
    return { ordered: true };
  }

  async createCollection(
    user: AuthenticatedUser,
    storePublicId: string,
    input: CreateCollectionDto,
  ) {
    const store = await this.managedStore(user.id, storePublicId);
    const listings = await this.prisma.listing.findMany({
      where: { publicId: { in: input.listingPublicIds }, storeId: store.id },
      select: { id: true, publicId: true },
    });
    if (listings.length !== new Set(input.listingPublicIds).size)
      throw new BadRequestException('Collection contains an invalid listing');
    return this.prisma.collection.create({
      data: {
        storeId: store.id,
        nameUz: input.nameUz,
        nameRu: input.nameRu ?? null,
        items: {
          create: listings.map((listing, index) => ({
            listingId: listing.id,
            position: index,
          })),
        },
      },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: { listing: { select: { publicId: true, nameUz: true } } },
        },
      },
    });
  }

  async marketplace(query: MarketplaceQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 12;
    const listings = await this.prisma.listing.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        store: {
          status: 'ACTIVE',
          vacationMode: false,
          ...(query.trust
            ? { sellerProfile: { trustBadge: query.trust } }
            : {}),
        },
        ...(query.category
          ? {
              category: {
                OR: [
                  { slug: query.category },
                  { nameUz: { equals: query.category, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
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
      orderBy:
        query.sort === 'price-asc'
          ? { priceMinor: 'asc' }
          : query.sort === 'price-desc'
            ? { priceMinor: 'desc' }
            : { createdAt: 'desc' },
      take: 500,
      select: {
        publicId: true,
        nameUz: true,
        nameRu: true,
        priceMinor: true,
        salePriceMinor: true,
        currency: true,
        descriptionUz: true,
        descriptionRu: true,
        category: { select: { slug: true, nameUz: true, nameRu: true } },
        store: {
          select: {
            username: true,
            nameUz: true,
            nameRu: true,
            sellerProfile: { select: { trustBadge: true } },
          },
        },
        variants: {
          select: {
            id: true,
            sku: true,
            options: true,
            priceOverrideMinor: true,
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
    const ranked = listings
      .map((listing) => ({
        ...listing,
        priceMinor: listing.priceMinor.toString(),
        salePriceMinor: listing.salePriceMinor?.toString() ?? null,
        variants: listing.variants.map((variant) => ({
          ...variant,
          priceOverrideMinor: variant.priceOverrideMinor?.toString() ?? null,
        })),
        score: marketplaceScore(query.q ?? '', [
          listing.nameUz,
          listing.nameRu,
          listing.descriptionUz,
          listing.descriptionRu,
          listing.category.nameUz,
          listing.category.nameRu,
          listing.store.nameUz,
          listing.store.nameRu,
        ]),
      }))
      .filter((listing) => !query.q || listing.score > 0);
    if (query.q && (!query.sort || query.sort === 'relevance'))
      ranked.sort((a, b) => b.score - a.score);
    const total = ranked.length;
    const start = (page - 1) * pageSize;
    return {
      items: ranked.slice(start, start + pageSize),
      pagination: {
        page,
        pageSize,
        total,
        pages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async getListing(publicId: string) {
    const listing = await this.prisma.listing.findFirst({
      where: {
        publicId,
        status: { in: ['ACTIVE', 'OUT_OF_STOCK', 'RESTRICTED'] },
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
            vacationMode: true,
            settings: {
              select: {
                deliverySettings: true,
                workingHours: true,
                vacationMessageUz: true,
              },
            },
            policies: {
              take: 1,
              orderBy: { version: 'desc' },
              select: { version: true, content: true, publishedAt: true },
            },
            sellerProfile: { select: { trustBadge: true, verifiedAt: true } },
          },
        },
        variants: { include: { inventory: true } },
        media: { orderBy: { position: 'asc' } },
      },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    const [questions, reviews] = await Promise.all([
      this.prisma.storeQuestion.findMany({
        where: { listingId: listing.id, reportedAt: null },
        take: 20,
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          body: true,
          pinned: true,
          createdAt: true,
          author: { select: { username: true } },
          answer: { select: { body: true, createdAt: true } },
        },
      }),
      this.prisma.review.findMany({
        where: {
          status: 'VISIBLE',
          order: { items: { some: { variant: { listingId: listing.id } } } },
        },
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: { id: true, rating: true, body: true, createdAt: true },
      }),
    ]);
    return {
      ...listing,
      purchasable: listing.status === 'ACTIVE' && !listing.store.vacationMode,
      priceMinor: listing.priceMinor.toString(),
      salePriceMinor: listing.salePriceMinor?.toString() ?? null,
      questions,
      reviews,
      rating: reviews.length
        ? {
            count: reviews.length,
            average:
              Math.round(
                (reviews.reduce((sum, review) => sum + review.rating, 0) /
                  reviews.length) *
                  10,
              ) / 10,
            distribution: Object.fromEntries(
              [5, 4, 3, 2, 1].map((rating) => [
                rating,
                reviews.filter((review) => review.rating === rating).length,
              ]),
            ),
          }
        : {
            count: 0,
            average: null,
            distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
          },
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

  async marketing(user: AuthenticatedUser, publicId: string) {
    const store = await this.managedStore(user.id, publicId);
    const [coupons, promotions] = await Promise.all([
      this.prisma.coupon.findMany({
        where: { storeId: store.id },
        orderBy: { startsAt: 'desc' },
        include: { _count: { select: { redemptions: true } } },
      }),
      this.prisma.promotion.findMany({
        where: { storeId: store.id },
        orderBy: { startsAt: 'desc' },
      }),
    ]);
    return {
      coupons: coupons.map((coupon) => ({
        ...coupon,
        valueMinor: coupon.valueMinor.toString(),
        minimumMinor: coupon.minimumMinor?.toString() ?? null,
        maximumDiscountMinor: coupon.maximumDiscountMinor?.toString() ?? null,
      })),
      promotions,
    };
  }

  async createTestimonial(
    user: AuthenticatedUser,
    publicId: string,
    input: CreateTestimonialDto,
  ) {
    const store = await this.managedStore(user.id, publicId);
    const created = await this.prisma.importedTestimonial.create({
      data: {
        storeId: store.id,
        sourceLabel: input.sourceLabel.trim(),
        authorLabel: input.authorLabel.trim(),
        body: input.body.trim(),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'IMPORTED_TESTIMONIAL_CREATED',
        targetType: 'ImportedTestimonial',
        targetId: created.id,
        metadata: { storeId: store.id, sourceLabel: created.sourceLabel },
      },
    });
    return created;
  }

  async removeTestimonial(
    user: AuthenticatedUser,
    publicId: string,
    id: string,
  ) {
    const store = await this.managedStore(user.id, publicId);
    const removed = await this.prisma.importedTestimonial.deleteMany({
      where: { id, storeId: store.id },
    });
    if (!removed.count)
      throw new NotFoundException('Imported testimonial not found');
    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'IMPORTED_TESTIMONIAL_REMOVED',
        targetType: 'ImportedTestimonial',
        targetId: id,
        metadata: { storeId: store.id },
      },
    });
    return { removed: true };
  }

  async createCoupon(
    user: AuthenticatedUser,
    publicId: string,
    input: CreateCouponDto,
  ) {
    const store = await this.managedStore(user.id, publicId);
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (endsAt <= startsAt)
      throw new BadRequestException('Coupon end must be after start');
    if (input.kind === 'PERCENT' && input.valueMinor > 10_000)
      throw new BadRequestException(
        'Percent coupon cannot exceed 10000 basis points',
      );
    const coupon = await this.prisma.coupon.create({
      data: {
        storeId: store.id,
        code: input.code,
        kind: input.kind,
        valueMinor: BigInt(input.valueMinor),
        minimumMinor:
          input.minimumMinor === undefined ? null : BigInt(input.minimumMinor),
        maximumDiscountMinor:
          input.maximumDiscountMinor === undefined
            ? null
            : BigInt(input.maximumDiscountMinor),
        usageLimit: input.usageLimit ?? null,
        buyerLimit: input.buyerLimit ?? null,
        startsAt,
        endsAt,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'COUPON_CREATED',
        targetType: 'Coupon',
        targetId: coupon.id,
      },
    });
    return {
      ...coupon,
      valueMinor: coupon.valueMinor.toString(),
      minimumMinor: coupon.minimumMinor?.toString() ?? null,
      maximumDiscountMinor: coupon.maximumDiscountMinor?.toString() ?? null,
    };
  }

  async toggleCoupon(user: AuthenticatedUser, publicId: string, id: string) {
    const store = await this.managedStore(user.id, publicId);
    const coupon = await this.prisma.coupon.findFirst({
      where: { id, storeId: store.id },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    const updated = await this.prisma.coupon.update({
      where: { id },
      data: { active: !coupon.active },
      select: { id: true, active: true },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'COUPON_TOGGLED',
        targetType: 'Coupon',
        targetId: id,
        metadata: { active: updated.active },
      },
    });
    return updated;
  }

  async createPromotion(
    user: AuthenticatedUser,
    publicId: string,
    input: CreatePromotionDto,
  ) {
    const store = await this.managedStore(user.id, publicId);
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (endsAt <= startsAt)
      throw new BadRequestException('Promotion end must be after start');
    const promotion = await this.prisma.promotion.create({
      data: {
        storeId: store.id,
        type: input.type.trim().toUpperCase(),
        startsAt,
        endsAt,
        metadata: input.metadata as object,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'PROMOTION_CREATED',
        targetType: 'Promotion',
        targetId: promotion.id,
      },
    });
    return promotion;
  }

  async analytics(user: AuthenticatedUser, publicId: string) {
    const store = await this.managedStore(user.id, publicId);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60_000);
    const [
      orders,
      completed,
      revenue,
      reviews,
      followers,
      questions,
      lowStock,
    ] = await Promise.all([
      this.prisma.order.count({
        where: { storeId: store.id, createdAt: { gte: since } },
      }),
      this.prisma.order.count({
        where: {
          storeId: store.id,
          status: 'COMPLETED',
          createdAt: { gte: since },
        },
      }),
      this.prisma.order.aggregate({
        where: {
          storeId: store.id,
          status: 'COMPLETED',
          createdAt: { gte: since },
        },
        _sum: { totalMinor: true },
      }),
      this.prisma.review.aggregate({
        where: {
          order: { storeId: store.id },
          status: 'VISIBLE',
          createdAt: { gte: since },
        },
        _avg: { rating: true },
        _count: true,
      }),
      this.prisma.storeFollower.count({ where: { storeId: store.id } }),
      this.prisma.storeQuestion.count({
        where: { storeId: store.id, createdAt: { gte: since } },
      }),
      this.prisma.inventory.count({
        where: {
          available: { lte: 3 },
          variant: { listing: { storeId: store.id } },
        },
      }),
    ]);
    return {
      periodDays: 30,
      orders,
      completed,
      conversionPercent: orders
        ? Math.round((completed / orders) * 1000) / 10
        : 0,
      revenueMinor: (revenue._sum.totalMinor ?? 0n).toString(),
      reviewAverage: reviews._avg.rating ?? null,
      reviewCount: reviews._count,
      followers,
      questions,
      lowStock,
    };
  }

  private async editableListing(user: AuthenticatedUser, publicId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { publicId },
      include: {
        store: {
          include: {
            sellerProfile: true,
            members: { where: { userId: user.id } },
          },
        },
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
    return listing;
  }

  private cleanVariantOptions(
    options: Record<string, string>,
  ): Record<string, string> {
    try {
      return cleanVariantOptions(options);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Variant options are invalid',
      );
    }
  }

  private validateAttributes(
    definitions: Array<{
      key: string;
      type: string;
      required: boolean;
      options: unknown;
    }>,
    values: Record<string, unknown>,
  ): Record<string, string | number | boolean | string[]> {
    try {
      return validateCategoryAttributes(definitions, values);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Category attributes are invalid',
      );
    }
  }
}
