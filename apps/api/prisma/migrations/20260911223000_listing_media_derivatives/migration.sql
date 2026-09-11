ALTER TABLE "ListingMedia"
ADD COLUMN "thumbnailStorageKey" TEXT,
ADD COLUMN "width" INTEGER,
ADD COLUMN "height" INTEGER;

CREATE UNIQUE INDEX "ListingMedia_thumbnailStorageKey_key"
ON "ListingMedia"("thumbnailStorageKey");

ALTER TABLE "ListingMedia"
ADD CONSTRAINT "ListingMedia_dimensions_check"
CHECK (
  ("width" IS NULL AND "height" IS NULL)
  OR ("width" > 0 AND "height" > 0)
);
