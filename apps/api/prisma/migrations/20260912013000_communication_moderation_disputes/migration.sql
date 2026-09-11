ALTER TABLE "Attachment" ADD COLUMN "fileName" TEXT NOT NULL DEFAULT 'attachment';
ALTER TABLE "Attachment" ADD COLUMN "uploaderId" UUID;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "QuestionReport" (
  "id" UUID NOT NULL,
  "questionId" UUID NOT NULL,
  "reporterId" UUID NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "resolution" TEXT,
  "reviewedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuestionReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuestionReport_status_check" CHECK ("status" IN ('OPEN', 'ACTIONED', 'DISMISSED')),
  CONSTRAINT "QuestionReport_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "StoreQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "QuestionReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "QuestionReport_questionId_reporterId_key" ON "QuestionReport"("questionId", "reporterId");
CREATE INDEX "QuestionReport_status_createdAt_idx" ON "QuestionReport"("status", "createdAt");

CREATE TABLE "DisputeEvidence" (
  "id" UUID NOT NULL,
  "disputeId" UUID NOT NULL,
  "uploadedById" UUID,
  "storageKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DisputeEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DisputeEvidence_size_check" CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 5242880),
  CONSTRAINT "DisputeEvidence_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DisputeEvidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DisputeEvidence_storageKey_key" ON "DisputeEvidence"("storageKey");
CREATE INDEX "DisputeEvidence_disputeId_createdAt_idx" ON "DisputeEvidence"("disputeId", "createdAt");

CREATE TABLE "DisputeDecision" (
  "id" UUID NOT NULL,
  "disputeId" UUID NOT NULL,
  "actorId" UUID,
  "outcome" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DisputeDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DisputeDecision_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DisputeDecision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DisputeDecision_disputeId_key" ON "DisputeDecision"("disputeId");
