CREATE TABLE "CategoryAttribute" (
  "id" UUID NOT NULL,
  "categoryId" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "labelUz" TEXT NOT NULL,
  "labelRu" TEXT,
  "type" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "options" JSONB,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "CategoryAttribute_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CategoryAttribute_type_check" CHECK ("type" IN ('TEXT', 'NUMBER', 'SELECT', 'MULTISELECT', 'BOOLEAN')),
  CONSTRAINT "CategoryAttribute_position_check" CHECK ("position" >= 0),
  CONSTRAINT "CategoryAttribute_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CategoryAttribute_categoryId_key_key" ON "CategoryAttribute"("categoryId", "key");
CREATE INDEX "CategoryAttribute_categoryId_position_idx" ON "CategoryAttribute"("categoryId", "position");

ALTER TABLE "Listing" ADD COLUMN "attributeValues" JSONB NOT NULL DEFAULT '{}';
