CREATE TABLE "StoreCustomer" (
  "id" UUID NOT NULL, "publicId" TEXT NOT NULL, "storeId" UUID NOT NULL,
  "name" TEXT NOT NULL, "phoneEncrypted" TEXT, "phoneHash" TEXT,
  "notes" TEXT, "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "StoreCustomer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StoreCustomer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StoreCustomer_publicId_key" ON "StoreCustomer"("publicId");
CREATE UNIQUE INDEX "StoreCustomer_storeId_phoneHash_key" ON "StoreCustomer"("storeId", "phoneHash");
CREATE INDEX "StoreCustomer_storeId_createdAt_idx" ON "StoreCustomer"("storeId", "createdAt");

CREATE TABLE "ExternalOrder" (
  "id" UUID NOT NULL, "publicId" TEXT NOT NULL, "storeId" UUID NOT NULL,
  "customerId" UUID, "source" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'NEW',
  "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID', "idempotencyKey" TEXT,
  "subtotalMinor" BIGINT NOT NULL, "discountMinor" BIGINT NOT NULL DEFAULT 0,
  "deliveryCostMinor" BIGINT NOT NULL DEFAULT 0, "totalMinor" BIGINT NOT NULL,
  "costOfGoodsMinor" BIGINT NOT NULL DEFAULT 0, "currency" TEXT NOT NULL DEFAULT 'UZS',
  "deliveryAddressEncrypted" TEXT, "courierName" TEXT, "trackingNumber" TEXT, "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "ExternalOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExternalOrder_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExternalOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "StoreCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ExternalOrder_source_check" CHECK ("source" IN ('INSTAGRAM','TELEGRAM','OFFLINE','OTHER')),
  CONSTRAINT "ExternalOrder_status_check" CHECK ("status" IN ('NEW','PENDING','CONFIRMED','PREPARING','READY','SHIPPED','DELIVERED','CANCELLED')),
  CONSTRAINT "ExternalOrder_paymentStatus_check" CHECK ("paymentStatus" IN ('UNPAID','PARTIAL','PAID','REFUNDED')),
  CONSTRAINT "ExternalOrder_money_check" CHECK ("subtotalMinor" >= 0 AND "discountMinor" >= 0 AND "deliveryCostMinor" >= 0 AND "totalMinor" >= 0 AND "costOfGoodsMinor" >= 0)
);
CREATE UNIQUE INDEX "ExternalOrder_publicId_key" ON "ExternalOrder"("publicId");
CREATE UNIQUE INDEX "ExternalOrder_storeId_idempotencyKey_key" ON "ExternalOrder"("storeId", "idempotencyKey");
CREATE INDEX "ExternalOrder_storeId_createdAt_idx" ON "ExternalOrder"("storeId", "createdAt");
CREATE INDEX "ExternalOrder_storeId_status_createdAt_idx" ON "ExternalOrder"("storeId", "status", "createdAt");
CREATE INDEX "ExternalOrder_customerId_createdAt_idx" ON "ExternalOrder"("customerId", "createdAt");

CREATE TABLE "ExternalOrderItem" (
  "id" UUID NOT NULL, "externalOrderId" UUID NOT NULL, "variantId" UUID NOT NULL,
  "quantity" INTEGER NOT NULL, "unitPriceMinor" BIGINT NOT NULL, "unitCostMinor" BIGINT NOT NULL DEFAULT 0,
  "snapshot" JSONB NOT NULL,
  CONSTRAINT "ExternalOrderItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExternalOrderItem_order_fkey" FOREIGN KEY ("externalOrderId") REFERENCES "ExternalOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExternalOrderItem_variant_fkey" FOREIGN KEY ("variantId") REFERENCES "ListingVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExternalOrderItem_amount_check" CHECK ("quantity" > 0 AND "unitPriceMinor" >= 0 AND "unitCostMinor" >= 0)
);
CREATE INDEX "ExternalOrderItem_externalOrderId_idx" ON "ExternalOrderItem"("externalOrderId");

CREATE TABLE "ExternalOrderHistory" (
  "id" UUID NOT NULL, "externalOrderId" UUID NOT NULL, "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL, "actorId" UUID, "reason" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExternalOrderHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExternalOrderHistory_order_fkey" FOREIGN KEY ("externalOrderId") REFERENCES "ExternalOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ExternalOrderHistory_externalOrderId_createdAt_idx" ON "ExternalOrderHistory"("externalOrderId", "createdAt");

CREATE TABLE "StockMovement" (
  "id" UUID NOT NULL, "storeId" UUID NOT NULL, "variantId" UUID NOT NULL,
  "externalOrderId" UUID, "actorId" UUID, "type" TEXT NOT NULL,
  "availableDelta" INTEGER NOT NULL, "reservedDelta" INTEGER NOT NULL DEFAULT 0,
  "reason" TEXT, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StockMovement_store_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockMovement_variant_fkey" FOREIGN KEY ("variantId") REFERENCES "ListingVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockMovement_externalOrder_fkey" FOREIGN KEY ("externalOrderId") REFERENCES "ExternalOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "StockMovement_storeId_createdAt_idx" ON "StockMovement"("storeId", "createdAt");
CREATE INDEX "StockMovement_variantId_createdAt_idx" ON "StockMovement"("variantId", "createdAt");

CREATE TABLE "SellerExpense" (
  "id" UUID NOT NULL, "publicId" TEXT NOT NULL, "storeId" UUID NOT NULL,
  "amountMinor" BIGINT NOT NULL, "category" TEXT NOT NULL, "note" TEXT,
  "occurredAt" TIMESTAMPTZ NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerExpense_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SellerExpense_store_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SellerExpense_amount_check" CHECK ("amountMinor" > 0)
);
CREATE UNIQUE INDEX "SellerExpense_publicId_key" ON "SellerExpense"("publicId");
CREATE INDEX "SellerExpense_storeId_occurredAt_idx" ON "SellerExpense"("storeId", "occurredAt");
