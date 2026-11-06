-- Registration profile: name and phone. Existing accounts keep NULL values.
ALTER TABLE "User"
  ADD COLUMN "fullName" TEXT,
  ADD COLUMN "phoneEncrypted" TEXT,
  ADD COLUMN "phoneHash" TEXT;
CREATE UNIQUE INDEX "User_phoneHash_key" ON "User"("phoneHash");
ALTER TABLE "User" ADD CONSTRAINT "User_fullName_length_check"
  CHECK ("fullName" IS NULL OR char_length("fullName") BETWEEN 2 AND 80);
