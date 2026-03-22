ALTER TABLE "purchase_items"
ADD COLUMN "quantityTransferred" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "transfer_items"
ADD COLUMN "quantityTransferred" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "sellingPrice" DECIMAL(18,2);

UPDATE "transfer_items"
SET "sellingPrice" = COALESCE("unitCost", 0)
WHERE "sellingPrice" IS NULL;

ALTER TABLE "transfer_items"
ALTER COLUMN "sellingPrice" SET NOT NULL;

ALTER TABLE "sale_item_allocations"
ADD COLUMN "transferItemId" TEXT;

ALTER TABLE "sale_item_allocations"
ADD CONSTRAINT "sale_item_allocations_transferItemId_fkey"
FOREIGN KEY ("transferItemId") REFERENCES "transfer_items"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
