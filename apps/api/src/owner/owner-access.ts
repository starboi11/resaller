import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { PrismaService } from '../infrastructure/prisma.service.js';
import type { AuthenticatedUser } from '../auth/session.guard.js';
import { ownerStoreUsername } from '../resale/resale-visibility.js';

/**
 * Only the owner sells (2026-11-03). "The owner" is decided by the server: the
 * one user whose seller profile owns the store named by OWNER_STORE_USERNAME.
 * There is no team: a former StoreMember of that store, the SELLER role, or
 * owning any other store grants nothing. Admin powers are separate and are
 * checked by RolesGuard on the admin routes, never by this guard.
 */
export type OwnerAccess = { storeId: string; storePublicId: string; username: string; nameUz: string; role: 'OWNER' };

export const isConfiguredOwnerStore = (store: { username: string }): boolean => {
  const owner = ownerStoreUsername();
  return Boolean(owner) && store.username === owner;
};

export async function resolveOwnerAccess(prisma: PrismaService, userId: string): Promise<OwnerAccess | null> {
  const username = ownerStoreUsername();
  if (!username) return null;
  const store = await prisma.store.findUnique({
    where: { username },
    select: { id: true, publicId: true, username: true, nameUz: true, sellerProfile: { select: { userId: true } } },
  });
  if (!store || store.sellerProfile.userId !== userId) return null;
  return { storeId: store.id, storePublicId: store.publicId, username: store.username, nameUz: store.nameUz, role: 'OWNER' };
}

// Routes whose `publicId` parameter names a store (not a listing).
const STORE_ROUTE = /\/stores\/:publicId(\/|$)/;

/**
 * Guards every store-management route. Runs after SessionGuard. When the
 * route targets a store by id, that store must be the owner store, so the
 * owner cannot be steered into managing some other store either.
 * With OWNER_STORE_USERNAME unset (local setup before the owner store exists)
 * the legacy per-store checks in the services still apply.
 */
@Injectable()
export class OwnerGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!ownerStoreUsername()) return true;
    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: AuthenticatedUser; params: Record<string, string> }>();
    if (!request.user) throw new ForbiddenException('Bu bo‘lim faqat do‘kon egasi uchun');
    const access = await resolveOwnerAccess(this.prisma, request.user.id);
    if (!access) throw new ForbiddenException('Bu bo‘lim faqat do‘kon egasi uchun');
    const route = request.routeOptions?.url ?? '';
    const storeParam = request.params.storeId ?? (STORE_ROUTE.test(route) ? request.params.publicId : undefined);
    if (storeParam !== undefined && storeParam !== access.storePublicId)
      throw new ForbiddenException('Bu bo‘lim faqat do‘kon egasi uchun');
    return true;
  }
}
