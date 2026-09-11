-- Existing metadata-only verification requests must attach a private document
-- before they can re-enter the administrator review queue.
UPDATE "SellerVerification"
SET "status" = 'DOCUMENT_REQUIRED', "submittedAt" = NULL
WHERE "status" = 'PENDING_REVIEW' AND "documentStorageKey" IS NULL;
