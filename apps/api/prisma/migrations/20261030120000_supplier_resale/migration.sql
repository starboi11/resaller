-- Supplier -> Reseller -> Buyer resale model.

CREATE TYPE "StoreKind" AS ENUM ('SELLER', 'SUPPLIER');
CREATE TYPE "EarningStatus" AS ENUM ('PENDING', 'AVAILABLE', 'PAID', 'CANCELLED');
CREATE TYPE "PayoutStatus" AS ENUM ('REQUESTED', 'PAID', 'REJECTED');

-- Store
ALTER TABLE "Store" ADD COLUMN "kind" "StoreKind" NOT NULL DEFAULT 'SELLER';
CREATE INDEX "Store_kind_status_idx" ON "Store"("kind", "status");

-- Listing
ALTER TABLE "Listing"
  ADD COLUMN "minMarkupBps" INTEGER,
  ADD COLUMN "maxMarkupBps" INTEGER,
  ADD COLUMN "recommendedRetailMinor" BIGINT,
  ADD COLUMN "sourceListingId" UUID,
  ADD COLUMN "markupBps" INTEGER;
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_sourceListingId_fkey"
  FOREIGN KEY ("sourceListingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_markup_check" CHECK (
  ("minMarkupBps" IS NULL OR "minMarkupBps" >= 0)
  AND ("maxMarkupBps" IS NULL OR "maxMarkupBps" >= 0)
  AND ("minMarkupBps" IS NULL OR "maxMarkupBps" IS NULL OR "minMarkupBps" <= "maxMarkupBps")
  AND ("recommendedRetailMinor" IS NULL OR "recommendedRetailMinor" >= 0)
  AND ("markupBps" IS NULL OR "markupBps" >= 0)
  AND (("sourceListingId" IS NULL) = ("markupBps" IS NULL))
  AND ("sourceListingId" IS NULL OR "sourceListingId" <> "id")
);
CREATE UNIQUE INDEX "Listing_storeId_sourceListingId_key" ON "Listing"("storeId", "sourceListingId");
CREATE INDEX "Listing_sourceListingId_idx" ON "Listing"("sourceListingId");

-- ListingVariant
ALTER TABLE "ListingVariant" ADD COLUMN "sourceVariantId" UUID;
ALTER TABLE "ListingVariant" ADD CONSTRAINT "ListingVariant_sourceVariantId_fkey"
  FOREIGN KEY ("sourceVariantId") REFERENCES "ListingVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ListingVariant" ADD CONSTRAINT "ListingVariant_source_not_self_check"
  CHECK ("sourceVariantId" IS NULL OR "sourceVariantId" <> "id");
CREATE INDEX "ListingVariant_sourceVariantId_idx" ON "ListingVariant"("sourceVariantId");

-- Order
ALTER TABLE "Order" ADD COLUMN "fulfillmentStoreId" UUID;
ALTER TABLE "Order" ADD CONSTRAINT "Order_fulfillmentStoreId_fkey"
  FOREIGN KEY ("fulfillmentStoreId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Order_fulfillmentStoreId_status_createdAt_idx" ON "Order"("fulfillmentStoreId", "status", "createdAt");

-- OrderItem
ALTER TABLE "OrderItem"
  ADD COLUMN "supplierVariantId" UUID,
  ADD COLUMN "supplierUnitPriceMinor" BIGINT,
  ADD COLUMN "resellerMarginMinor" BIGINT;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_resale_check" CHECK (
  ("supplierVariantId" IS NULL AND "supplierUnitPriceMinor" IS NULL AND "resellerMarginMinor" IS NULL)
  OR ("supplierVariantId" IS NOT NULL AND "supplierUnitPriceMinor" >= 0 AND "resellerMarginMinor" >= 0)
);

-- ResellerPayout
CREATE TABLE "ResellerPayout" (
  "id" UUID NOT NULL,
  "publicId" TEXT NOT NULL,
  "storeId" UUID NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'UZS',
  "status" "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
  "method" TEXT NOT NULL,
  "reference" TEXT,
  "requestedById" UUID,
  "decidedById" UUID,
  "decisionReason" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMPTZ,
  CONSTRAINT "ResellerPayout_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ResellerPayout_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ResellerPayout_amount_check" CHECK ("amountMinor" > 0)
);
CREATE UNIQUE INDEX "ResellerPayout_publicId_key" ON "ResellerPayout"("publicId");
CREATE INDEX "ResellerPayout_storeId_status_createdAt_idx" ON "ResellerPayout"("storeId", "status", "createdAt");

-- ResellerEarning
CREATE TABLE "ResellerEarning" (
  "id" UUID NOT NULL,
  "publicId" TEXT NOT NULL,
  "storeId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'UZS',
  "status" "EarningStatus" NOT NULL DEFAULT 'PENDING',
  "availableAt" TIMESTAMPTZ,
  "payoutId" UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "ResellerEarning_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ResellerEarning_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ResellerEarning_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ResellerEarning_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "ResellerPayout"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ResellerEarning_amount_check" CHECK ("amountMinor" >= 0),
  CONSTRAINT "ResellerEarning_paid_has_payout_check" CHECK ("status" <> 'PAID' OR "payoutId" IS NOT NULL)
);
CREATE UNIQUE INDEX "ResellerEarning_publicId_key" ON "ResellerEarning"("publicId");
CREATE UNIQUE INDEX "ResellerEarning_orderId_key" ON "ResellerEarning"("orderId");
CREATE INDEX "ResellerEarning_storeId_status_createdAt_idx" ON "ResellerEarning"("storeId", "status", "createdAt");
CREATE INDEX "ResellerEarning_payoutId_idx" ON "ResellerEarning"("payoutId");
