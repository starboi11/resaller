-- DropIndex
DROP INDEX "CouponRedemption_orderId_idx";

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" UUID NOT NULL,
    "publicId" TEXT NOT NULL,
    "telegramChatId" TEXT NOT NULL,
    "username" TEXT,
    "displayName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "lastMessageAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "direction" TEXT NOT NULL,
    "telegramMessageId" TEXT,
    "operatorTelegramMessageId" TEXT,
    "body" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_publicId_key" ON "SupportTicket"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_telegramChatId_key" ON "SupportTicket"("telegramChatId");

-- CreateIndex
CREATE INDEX "SupportTicket_status_lastMessageAt_idx" ON "SupportTicket"("status", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportMessage_operatorTelegramMessageId_key" ON "SupportMessage"("operatorTelegramMessageId");

-- CreateIndex
CREATE INDEX "SupportMessage_ticketId_createdAt_idx" ON "SupportMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportMessage_ticketId_telegramMessageId_key" ON "SupportMessage"("ticketId", "telegramMessageId");

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
