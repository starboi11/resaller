import type { Prisma } from '../generated/prisma/client.js';
import { EARNING_HOLD_DAYS, resellerUnitPrice } from './resale-pricing.js';

type Tx = Prisma.TransactionClient;

/**
 * Recomputes the display-price cache of every resale listing built on a supplier
 * listing and creates mirrors for supplier variants added later. Checkout never
 * trusts this cache; it recomputes from current supplier prices.
 */
export async function syncResalePrices(tx: Tx, sourceListingId: string) {
  const source = await tx.listing.findUnique({
    where: { id: sourceListingId },
    select: { priceMinor: true, variants: { select: { id: true, sku: true, options: true, priceOverrideMinor: true } } },
  });
  if (!source) return;
  const resold = await tx.listing.findMany({
    where: { sourceListingId, deletedAt: null },
    select: { id: true, markupBps: true, variants: { select: { id: true, sourceVariantId: true } } },
  });
  for (const listing of resold) {
    const markup = listing.markupBps ?? 0;
    await tx.listing.update({ where: { id: listing.id }, data: { priceMinor: resellerUnitPrice(source.priceMinor, markup) } });
    for (const sourceVariant of source.variants) {
      const price = sourceVariant.priceOverrideMinor === null ? null : resellerUnitPrice(sourceVariant.priceOverrideMinor, markup);
      const mirror = listing.variants.find((variant) => variant.sourceVariantId === sourceVariant.id);
      if (mirror) await tx.listingVariant.update({ where: { id: mirror.id }, data: { priceOverrideMinor: price } });
      else
        await tx.listingVariant.create({
          data: { listingId: listing.id, sku: sourceVariant.sku, options: sourceVariant.options as Prisma.InputJsonValue,
            priceOverrideMinor: price, sourceVariantId: sourceVariant.id },
        });
    }
  }
}

export type EarningEvent =
  | 'COMPLETED' | 'REJECTED' | 'TIMEOUT' | 'CANCELLED' | 'DISPUTED' | 'RETURN_REQUESTED'
  | 'RETURN_APPROVED' | 'DISPUTE_BUYER' | 'DISPUTE_SELLER' | 'DISPUTE_PARTIAL';

/**
 * Moves the reseller earning of one order through its lifecycle. PAID and
 * CANCELLED are final. Anything that puts the sale in doubt makes the earning
 * non-payable again (PENDING); an admin then rejects any open payout holding it.
 */
export async function syncResellerEarning(tx: Tx, orderId: string, event: string, now = new Date()) {
  const earning = await tx.resellerEarning.findUnique({ where: { orderId }, select: { id: true, status: true } });
  if (!earning || earning.status === 'PAID' || earning.status === 'CANCELLED') return;
  const cancel = () => tx.resellerEarning.update({ where: { id: earning.id }, data: { status: 'CANCELLED', availableAt: null, payoutId: null } });
  const release = () => tx.resellerEarning.update({ where: { id: earning.id },
    data: { status: 'AVAILABLE', availableAt: new Date(now.getTime() + EARNING_HOLD_DAYS * 86_400_000) } });
  const hold = () => tx.resellerEarning.update({ where: { id: earning.id }, data: { status: 'PENDING', availableAt: null } });
  switch (event as EarningEvent) {
    case 'REJECTED': case 'TIMEOUT': case 'CANCELLED': case 'RETURN_APPROVED': case 'DISPUTE_BUYER':
      await cancel();
      return;
    case 'COMPLETED': case 'DISPUTE_SELLER':
      if (earning.status === 'PENDING') await release();
      return;
    case 'DISPUTED': case 'RETURN_REQUESTED': case 'DISPUTE_PARTIAL':
      if (earning.status === 'AVAILABLE') await hold();
      return;
    default:
      return;
  }
}
