ALTER TABLE "ListingMedia" ADD COLUMN "variantId" UUID;
ALTER TABLE "ConversationMember" ADD COLUMN "lastReadAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "SavedAddress" (
  "id" UUID NOT NULL,
  "publicId" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "label" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "SavedAddress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SavedAddress_publicId_key" ON "SavedAddress"("publicId");
CREATE INDEX "SavedAddress_userId_isDefault_idx" ON "SavedAddress"("userId", "isDefault");
ALTER TABLE "SavedAddress" ADD CONSTRAINT "SavedAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingMedia" ADD CONSTRAINT "ListingMedia_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ListingVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "ListingMedia_variantId_idx" ON "ListingMedia"("variantId");
