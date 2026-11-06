-- Existing privileged sessions must authenticate again after this migration.
-- Buyer/seller sessions are unaffected.
ALTER TABLE "Session" ADD COLUMN "twoFactorVerifiedAt" TIMESTAMPTZ;
