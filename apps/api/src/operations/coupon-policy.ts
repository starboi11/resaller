export type CouponInput = {
  kind: string;
  valueMinor: bigint;
  minimumMinor: bigint | null;
  maximumDiscountMinor: bigint | null;
};

export function couponDiscount(coupon: CouponInput, subtotal: bigint): bigint {
  if (coupon.minimumMinor !== null && subtotal < coupon.minimumMinor) return 0n;
  let discount: bigint;
  if (coupon.kind === 'FIXED') discount = coupon.valueMinor;
  else if (coupon.kind === 'PERCENT')
    discount = (subtotal * coupon.valueMinor) / 10_000n;
  else return 0n;
  if (
    coupon.maximumDiscountMinor !== null &&
    discount > coupon.maximumDiscountMinor
  )
    discount = coupon.maximumDiscountMinor;
  return discount > subtotal ? subtotal : discount;
}
