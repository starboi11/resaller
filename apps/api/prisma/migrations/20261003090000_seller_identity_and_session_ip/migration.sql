ALTER TABLE "SellerVerification" ADD COLUMN "documentNumberEncrypted" TEXT;
ALTER TABLE "SellerVerification" ADD COLUMN "phoneEncrypted" TEXT;
ALTER TABLE "SellerVerification" ADD COLUMN "phoneMasked" TEXT;
ALTER TABLE "SellerVerification" ADD COLUMN "residenceAddressEncrypted" TEXT;
ALTER TABLE "Session" ADD COLUMN "ipEncrypted" TEXT;
