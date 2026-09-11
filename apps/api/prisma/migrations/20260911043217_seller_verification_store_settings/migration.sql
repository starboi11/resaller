-- CreateTable
CREATE TABLE "SellerVerification" (
    "id" UUID NOT NULL,
    "sellerProfileId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "legalName" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumberMasked" TEXT NOT NULL,
    "documentStorageKey" TEXT,
    "submittedAt" TIMESTAMPTZ,
    "reviewedAt" TIMESTAMPTZ,
    "reviewReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SellerVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSetting" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "workingHours" JSONB NOT NULL,
    "deliverySettings" JSONB NOT NULL,
    "vacationMessageUz" TEXT,
    "vacationMessageRu" TEXT,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "StoreSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SellerVerification_sellerProfileId_key" ON "SellerVerification"("sellerProfileId");

-- CreateIndex
CREATE INDEX "SellerVerification_status_submittedAt_idx" ON "SellerVerification"("status", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StoreSetting_storeId_key" ON "StoreSetting"("storeId");

-- AddForeignKey
ALTER TABLE "SellerVerification" ADD CONSTRAINT "SellerVerification_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSetting" ADD CONSTRAINT "StoreSetting_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
