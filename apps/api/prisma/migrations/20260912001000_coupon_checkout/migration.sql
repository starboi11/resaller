ALTER TABLE "Order" ADD COLUMN "subtotalMinor" BIGINT;
ALTER TABLE "Order" ADD COLUMN "discountMinor" BIGINT NOT NULL DEFAULT 0;
UPDATE "Order" SET "subtotalMinor" = "totalMinor" WHERE "subtotalMinor" IS NULL;
ALTER TABLE "Order" ALTER COLUMN "subtotalMinor" SET NOT NULL;

ALTER TABLE "Order" ADD CONSTRAINT "Order_amounts_check"
CHECK ("subtotalMinor" >= 0 AND "discountMinor" >= 0 AND "totalMinor" = "subtotalMinor" - "discountMinor" AND "totalMinor" >= 0);

ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "CouponRedemption_orderId_idx" ON "CouponRedemption"("orderId");
