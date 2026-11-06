// Pure money and stock rules for the Supplier -> Reseller -> Buyer model.
// All money is BigInt minor units (so'm). Markup is basis points (1000 = 10 %).

export const DEFAULT_MIN_MARKUP_BPS = 1000;
export const DEFAULT_MAX_MARKUP_BPS = 2500;
export const MAX_MARKUP_BPS = 10_000;
export const MIN_PAYOUT_MINOR = 50_000n;
export const EARNING_HOLD_DAYS = 7;

export type MarkupWindow = { min: number; max: number };

export const markupWindow = (listing: {
  minMarkupBps: number | null;
  maxMarkupBps: number | null;
}): MarkupWindow => ({
  min: listing.minMarkupBps ?? DEFAULT_MIN_MARKUP_BPS,
  max: listing.maxMarkupBps ?? DEFAULT_MAX_MARKUP_BPS,
});

export const isValidMarkupBps = (markupBps: number): boolean =>
  Number.isSafeInteger(markupBps) && markupBps >= 0 && markupBps <= MAX_MARKUP_BPS;

export const isMarkupAllowed = (markupBps: number, window: MarkupWindow): boolean =>
  isValidMarkupBps(markupBps) && markupBps >= window.min && markupBps <= window.max;

/** Reseller unit price R = ceil(W * (10000 + m) / 10000). */
export const resellerUnitPrice = (wholesaleMinor: bigint, markupBps: number): bigint => {
  if (wholesaleMinor < 0n) throw new RangeError('Wholesale price cannot be negative');
  if (!isValidMarkupBps(markupBps)) throw new RangeError('Invalid markup');
  return (wholesaleMinor * BigInt(10_000 + markupBps) + 9_999n) / 10_000n;
};

export const marginPerUnit = (wholesaleMinor: bigint, markupBps: number): bigint =>
  resellerUnitPrice(wholesaleMinor, markupBps) - wholesaleMinor;

/** Supplier unit price: same resolution rule the checkout uses for every listing. */
export const wholesaleUnitPrice = (
  sourceVariant: { priceOverrideMinor: bigint | null },
  sourceListing: { priceMinor: bigint },
): bigint => sourceVariant.priceOverrideMinor ?? sourceListing.priceMinor;

/** The variant whose Inventory row holds the stock (supplier variant for resale items). */
export const inventoryVariantId = (variant: { id: string; sourceVariantId: string | null }): string =>
  variant.sourceVariantId ?? variant.id;

/** Earning amount for one resale order: total margin minus the reseller's coupon. */
export const earningAmount = (marginTotalMinor: bigint, discountMinor: bigint): bigint | null =>
  discountMinor > marginTotalMinor ? null : marginTotalMinor - discountMinor;
