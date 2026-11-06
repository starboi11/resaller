CREATE TABLE "SiteVisit" (
    "id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "pageViews" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteVisit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SiteVisit_day_visitorHash_key" ON "SiteVisit"("day", "visitorHash");
CREATE INDEX "SiteVisit_day_idx" ON "SiteVisit"("day");

-- Legacy manual-review rows are published only when the existing seller,
-- store, image and stock gates are already satisfied.
UPDATE "Store" s SET "status" = 'ACTIVE'
FROM "SellerProfile" sp, "SellerVerification" v
WHERE s."sellerProfileId" = sp."id"
  AND v."sellerProfileId" = sp."id"
  AND s."status" = 'PENDING_REVIEW'
  AND sp."verifiedAt" IS NOT NULL
  AND v."status" = 'APPROVED'
  AND v."documentStorageKey" IS NOT NULL;

UPDATE "Listing" l SET "status" = 'ACTIVE'
FROM "Store" s, "SellerProfile" sp
WHERE l."storeId" = s."id"
  AND s."sellerProfileId" = sp."id"
  AND l."status" = 'PENDING_REVIEW'
  AND s."status" = 'ACTIVE'
  AND sp."verifiedAt" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "ListingMedia" m WHERE m."listingId" = l."id")
  AND EXISTS (SELECT 1 FROM "ListingVariant" lv JOIN "Inventory" i ON i."variantId" = lv."id" WHERE lv."listingId" = l."id" AND i."available" > 0);
