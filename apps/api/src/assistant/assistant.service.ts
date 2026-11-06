import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/session.guard.js';
import { PrismaService } from '../infrastructure/prisma.service.js';
import { RedisService } from '../infrastructure/redis.service.js';
import type { AssistantRequestDto } from './assistant.dto.js';
import { marketplaceScore } from '../commerce/marketplace-search.js';
import { buyerVisibleListing, ownerStoreUsername } from '../resale/resale-visibility.js';
import { resolveOwnerAccess } from '../owner/owner-access.js';

const INJECTION_PATTERNS = [
  /ignore (all|any|the|previous) (instructions|rules)/i,
  /system (prompt|message|instructions)/i,
  /developer (prompt|message|instructions)/i,
  /reveal.{0,20}(secret|token|password|prompt)/i,
  /bypass.{0,20}(authorization|permission|security)/i,
  /<\/?(system|assistant|developer)>/i,
];

type WindowState = { startedAt: number; count: number };

@Injectable()
export class AssistantService {
  private readonly windows = new Map<string, WindowState>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(RedisService) private readonly redis?: RedisService,
  ) {}

  async answer(user: AuthenticatedUser, input: AssistantRequestDto) {
    await this.enforceRateLimit(user.id);
    const promptHash = createHash('sha256').update(input.message).digest('hex');
    if (INJECTION_PATTERNS.some((pattern) => pattern.test(input.message))) {
      await this.audit(user.id, input.mode, 'REFUSED_INJECTION', promptHash, 0);
      return {
        status: 'REFUSED',
        answer:
          'Bu so‘rov xavfsizlik qoidalarini chetlab o‘tishga urinayotgandek ko‘rindi. Mahsulot yoki o‘zingizning buyurtmangiz bo‘yicha savol bering.',
        sources: [],
      };
    }

    const result =
      input.mode === 'DISCOVER'
        ? await this.discover(input.message)
        : input.mode === 'COMPARE'
          ? await this.compare(input.entityIds ?? [])
          : input.mode === 'ORDER_HELP'
            ? await this.orderHelp(user, input.entityIds?.[0])
            : await this.sellerHelp(user, input.entityIds?.[0]);

    await this.audit(
      user.id,
      input.mode,
      'ANSWERED',
      promptHash,
      result.sources.length,
    );
    return { status: 'OK', ...result };
  }

  private async discover(message: string) {
    const listings = await this.prisma.listing.findMany({
      where: {
        status: 'ACTIVE',
        ...buyerVisibleListing(),
        store: { kind: 'SELLER', status: 'ACTIVE', vacationMode: false },
      },
      take: 250,
      orderBy: { createdAt: 'desc' },
      select: {
        publicId: true,
        nameUz: true,
        nameRu: true,
        descriptionUz: true,
        descriptionRu: true,
        priceMinor: true,
        salePriceMinor: true,
        currency: true,
        store: {
          select: {
            nameUz: true,
            nameRu: true,
            sellerProfile: { select: { trustBadge: true } },
          },
        },
        variants: { select: { inventory: { select: { available: true } }, sourceVariant: { select: { inventory: { select: { available: true } } } } } },
      },
    });
    const matches = listings
      .map((listing) => ({
        listing,
        score: marketplaceScore(message, [
          listing.nameUz,
          listing.nameRu,
          listing.descriptionUz,
          listing.descriptionRu,
          listing.store.nameUz,
          listing.store.nameRu,
        ]),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(({ listing }) => listing);
    if (!matches.length)
      return {
        answer:
          'Mos faol mahsulot topilmadi. Nomi, kategoriya yoki kerakli xususiyatni aniqroq yozing.',
        sources: [],
      };
    return {
      answer: `Siz uchun ${matches.length} ta faol mahsulot topdim. Narx, xususiyat va mavjudlikni mahsulot sahifasida tekshiring.`,
      sources: matches.map((listing) => ({
        type: 'PRODUCT',
        id: listing.publicId,
        title: listing.nameUz,
        href: `/product/${listing.publicId}`,
        detail: `${Number(listing.salePriceMinor ?? listing.priceMinor).toLocaleString('uz-UZ')} ${listing.currency} · ${listing.store.nameUz} · ${listing.variants.reduce((sum, variant) => sum + ((variant.inventory ?? variant.sourceVariant?.inventory)?.available ?? 0), 0)} dona`,
      })),
    };
  }

  private async compare(ids: string[]) {
    const selected = [...new Set(ids)].slice(0, 4);
    if (selected.length < 2)
      return {
        answer: 'Taqqoslash uchun kamida 2 ta mahsulot ID sini tanlang.',
        sources: [],
      };
    const listings = await this.prisma.listing.findMany({
      where: {
        publicId: { in: selected },
        status: 'ACTIVE',
        ...buyerVisibleListing(),
        store: { kind: 'SELLER', status: 'ACTIVE', vacationMode: false },
      },
      select: {
        publicId: true,
        nameUz: true,
        priceMinor: true,
        salePriceMinor: true,
        currency: true,
        attributeValues: true,
        store: {
          select: {
            nameUz: true,
            sellerProfile: { select: { trustBadge: true } },
          },
        },
      },
    });
    return {
      answer:
        'Tanlangan mahsulotlar real katalog ma’lumotlari asosida solishtirildi. Yakuniy tanlovdan oldin mahsulot sahifasidagi variant va yetkazishni tekshiring.',
      sources: listings.map((listing) => ({
        type: 'PRODUCT',
        id: listing.publicId,
        title: listing.nameUz,
        href: `/product/${listing.publicId}`,
        detail: `${Number(listing.salePriceMinor ?? listing.priceMinor).toLocaleString('uz-UZ')} ${listing.currency} · ${listing.store.nameUz}`,
        attributes: listing.attributeValues,
      })),
    };
  }

  private async orderHelp(user: AuthenticatedUser, publicId?: string) {
    if (!publicId)
      return { answer: 'Buyurtma public ID sini kiriting.', sources: [] };
    const order = await this.prisma.order.findUnique({
      where: { publicId },
      include: {
        store: { include: { sellerProfile: true } },
        history: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    const allowed =
      order.buyerId === user.id ||
      (order.store.sellerProfile.userId === user.id &&
        (!ownerStoreUsername() || order.store.username === ownerStoreUsername()));
    if (!allowed) throw new ForbiddenException('Order access denied');
    const guidance: Record<string, string> = {
      WAITING_SELLER: 'Seller buyurtmani 60 daqiqa ichida qabul qilishi kerak.',
      ACCEPTED:
        'Seller buyurtmani tayyorlayapti. Keyingi yangilanishni timeline orqali kuzating.',
      READY:
        'Buyurtma tayyor. Yetkazish yoki olib ketish tafsilotini seller bilan chatda aniqlang.',
      COMPLETED:
        'Buyurtma yakunlangan. Tajribangiz bo‘yicha tasdiqlangan sharh qoldirishingiz mumkin.',
      CANCELLED: 'Buyurtma bekor qilingan. Sabab timeline’da ko‘rsatiladi.',
      DISPUTED: 'Nizo ochilgan. Dalillarni dispute oynasi orqali yuboring.',
    };
    return {
      answer:
        guidance[order.status] ?? `Buyurtmaning joriy holati: ${order.status}.`,
      sources: [
        {
          type: 'ORDER',
          id: order.publicId,
          title: order.displayId,
          href: `/orders/${order.publicId}`,
          detail: `${order.status} · ${order.history.length} ta timeline hodisasi`,
        },
      ],
    };
  }

  private async sellerHelp(user: AuthenticatedUser, storePublicId?: string) {
    // Form help is an owner tool: with the owner store configured, only its
    // owner gets it, and only for that store (there is no team).
    const owner = ownerStoreUsername();
    if (owner && !(await resolveOwnerAccess(this.prisma, user.id)))
      throw new ForbiddenException('Bu bo‘lim faqat do‘kon egasi uchun');
    const store = await this.prisma.store.findFirst({
      where: {
        ...(owner ? { username: owner } : {}),
        ...(storePublicId ? { publicId: storePublicId } : {}),
        OR: [
          { sellerProfile: { userId: user.id } },
          { members: { some: { userId: user.id } } },
        ],
      },
      select: {
        publicId: true,
        nameUz: true,
        status: true,
        logoStorageKey: true,
        bannerStorageKey: true,
      },
    });
    if (!store) throw new ForbiddenException('Seller store access required');
    const missing = [
      !store.logoStorageKey && 'logo',
      !store.bannerStorageKey && 'banner',
      store.status !== 'ACTIVE' && 'verification/moderation',
    ].filter(Boolean);
    return {
      answer: missing.length
        ? `${store.nameUz} uchun keyingi tavsiya: ${missing.join(', ')} qismini yakunlang. Mahsulot wizardida tafsilot → media → narx/variant → preview ketma-ketligidan foydalaning.`
        : `${store.nameUz} profili tayyor. Endi mahsulot wizardida barcha majburiy maydonlarni to‘ldirib preview orqali moderatsiyaga yuboring.`,
      sources: [
        {
          type: 'STORE',
          id: store.publicId,
          title: store.nameUz,
          href: '/seller/manage',
          detail: store.status,
        },
      ],
    };
  }

  private async enforceRateLimit(userId: string) {
    if (this.redis) {
      try {
        if (!(await this.redis.fixedWindowLimit(`assistant:${userId}`, 20, 60)))
          throw new HttpException(
            'Assistant rate limit exceeded',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        return;
      } catch (error) {
        if (error instanceof HttpException) throw error;
        // Local development remains usable when Redis is temporarily offline.
      }
    }
    const now = Date.now();
    const current = this.windows.get(userId);
    if (!current || now - current.startedAt >= 60_000) {
      this.windows.set(userId, { startedAt: now, count: 1 });
      return;
    }
    if (current.count >= 20)
      throw new HttpException(
        'Assistant rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    current.count += 1;
  }

  private audit(
    actorId: string,
    mode: string,
    outcome: string,
    promptHash: string,
    sourceCount: number,
  ) {
    return this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'AI_ASSISTANT_REQUEST',
        targetType: 'Assistant',
        targetId: mode,
        reason: outcome,
        metadata: { promptHash, sourceCount, provider: 'RULE_BASED_MVP' },
      },
    });
  }
}
