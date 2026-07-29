-- Track stock corrections without rewriting completed sale lines or their
-- allocation costs.
CREATE TYPE "InventoryAdjustmentType" AS ENUM (
  'PURCHASE_PRICE',
  'SELLING_PRICE',
  'QUANTITY'
);

ALTER TABLE "purchase_items"
ADD COLUMN "quantityAdjustment" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "transfer_items"
ADD COLUMN "quantityAdjustment" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "inventory_adjustments" (
  "id" TEXT NOT NULL,
  "adjustmentType" "InventoryAdjustmentType" NOT NULL,
  "batchId" TEXT NOT NULL,
  "batchType" TEXT NOT NULL,
  "referenceNumber" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "previousValue" DECIMAL(18, 2) NOT NULL,
  "newValue" DECIMAL(18, 2) NOT NULL,
  "quantityDelta" INTEGER,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "inventory_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inventory_adjustments_batchId_createdAt_idx"
ON "inventory_adjustments"("batchId", "createdAt");

CREATE INDEX "inventory_adjustments_productId_createdAt_idx"
ON "inventory_adjustments"("productId", "createdAt");

CREATE INDEX "inventory_adjustments_branchId_createdAt_idx"
ON "inventory_adjustments"("branchId", "createdAt");

CREATE INDEX "inventory_adjustments_adjustmentType_createdAt_idx"
ON "inventory_adjustments"("adjustmentType", "createdAt");

ALTER TABLE "inventory_adjustments"
ADD CONSTRAINT "inventory_adjustments_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "products"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_adjustments"
ADD CONSTRAINT "inventory_adjustments_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "branches"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_adjustments"
ADD CONSTRAINT "inventory_adjustments_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
