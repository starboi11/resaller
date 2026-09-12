ALTER TABLE "User" ADD COLUMN "accountStatus" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "User" ADD COLUMN "accountStatusReason" TEXT;
ALTER TABLE "User" ADD COLUMN "accountStatusChangedAt" TIMESTAMPTZ;
ALTER TABLE "User" ADD CONSTRAINT "User_accountStatus_check" CHECK ("accountStatus" IN ('ACTIVE', 'SUSPENDED', 'CLOSED'));

ALTER TABLE "Review" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'VISIBLE';
ALTER TABLE "Review" ADD COLUMN "moderationReason" TEXT;
ALTER TABLE "Review" ADD COLUMN "moderatedAt" TIMESTAMPTZ;
ALTER TABLE "Review" ADD COLUMN "moderatedById" UUID;
ALTER TABLE "Review" ADD CONSTRAINT "Review_status_check" CHECK ("status" IN ('VISIBLE', 'HIDDEN'));
ALTER TABLE "Review" ADD CONSTRAINT "Review_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Review_status_createdAt_idx" ON "Review"("status", "createdAt");

ALTER TABLE "SecurityEvent" ADD COLUMN "reviewedAt" TIMESTAMPTZ;
ALTER TABLE "SecurityEvent" ADD COLUMN "reviewedById" UUID;
ALTER TABLE "SecurityEvent" ADD COLUMN "resolution" TEXT;
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "SecurityEvent_reviewedAt_severity_createdAt_idx" ON "SecurityEvent"("reviewedAt", "severity", "createdAt");
