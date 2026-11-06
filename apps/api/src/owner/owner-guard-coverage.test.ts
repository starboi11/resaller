import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { OwnerGuard } from './owner-access.js';
import { CommerceController } from '../commerce/commerce.controller.js';
import { OperationsController } from '../operations/operations.controller.js';
import { MediaController } from '../media/media.controller.js';
import { SellerCenterController } from '../seller-center/seller-center.controller.js';

// Every store-management route must carry OwnerGuard. A route that only has
// SessionGuard lets any old SELLER account manage its own store again (this
// happened once with Seller Center, caught by an HTTP check on 2026-11-03).
const MANAGEMENT = /^(seller\/(stores|onboarding|orders|dashboard)|stores\/:publicId\/(submit|settings|vacation|listings|collections|testimonials|coupons|promotions|analytics|marketing)|listings\/:publicId|questions\/:id\/answer)/;
const MEDIA_MANAGEMENT = /^(listings\/:publicId\/(images|video)|stores\/:publicId\/:kind)$/;

type Ctor = { prototype: object; name: string };
const guards = (target: object): unknown[] => (Reflect.getMetadata(GUARDS_METADATA, target) as unknown[] | undefined) ?? [];
function routes(controller: Ctor) {
  const proto = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(proto)
    .filter((name) => name !== 'constructor' && Reflect.getMetadata(PATH_METADATA, proto[name] as object) !== undefined)
    .map((name) => ({ name, path: String(Reflect.getMetadata(PATH_METADATA, proto[name] as object)), guarded: [...guards(controller), ...guards(proto[name] as object)].includes(OwnerGuard) }));
}

describe('owner-only management routes', () => {
  it('guards all of Seller Center at class level', () => {
    expect(guards(SellerCenterController)).toContain(OwnerGuard);
  });

  it('guards every management route in commerce, operations and media', () => {
    const missing = [
      ...routes(CommerceController).filter((r) => MANAGEMENT.test(r.path) && !r.guarded),
      ...routes(OperationsController).filter((r) => MANAGEMENT.test(r.path) && !r.guarded),
      ...routes(MediaController).filter((r) => MEDIA_MANAGEMENT.test(r.path) && !r.guarded),
    ].map((r) => r.path);
    expect(missing).toEqual([]);
  });

  it('leaves buyer routes open to buyers', () => {
    const buyerPaths = ['marketplace/listings', 'categories', 'favorites', 'stores/:username'];
    const guardedBuyer = routes(CommerceController).filter((r) => buyerPaths.includes(r.path) && r.guarded);
    expect(guardedBuyer).toEqual([]);
  });
});
