CREATE TABLE "NotificationEndpoint" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "channel" TEXT NOT NULL,
  "valueHash" TEXT NOT NULL,
  "valueEncrypted" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationEndpoint_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationEndpoint_channel_check" CHECK ("channel" IN ('EMAIL', 'TELEGRAM', 'PUSH')),
  CONSTRAINT "NotificationEndpoint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "NotificationEndpoint_userId_channel_valueHash_key" ON "NotificationEndpoint"("userId", "channel", "valueHash");
CREATE INDEX "NotificationEndpoint_userId_channel_active_idx" ON "NotificationEndpoint"("userId", "channel", "active");

CREATE TABLE "NotificationDelivery" (
  "id" UUID NOT NULL,
  "notificationId" UUID NOT NULL,
  "endpointId" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "deliveredAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationDelivery_status_check" CHECK ("status" IN ('QUEUED', 'PROCESSING', 'DELIVERED', 'FAILED')),
  CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NotificationDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "NotificationEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "NotificationDelivery_notificationId_endpointId_key" ON "NotificationDelivery"("notificationId", "endpointId");
CREATE INDEX "NotificationDelivery_status_updatedAt_idx" ON "NotificationDelivery"("status", "updatedAt");
